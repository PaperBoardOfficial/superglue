import { PostHog } from 'posthog-node';
import { config } from '../default.js';

// we use a privacy-preserving session id to track queries
export const sessionId = crypto.randomUUID();

export const isDebug = process.env.DEBUG === "true";
export const isTelemetryDisabled = process.env.DISABLE_TELEMETRY === "true";

export const telemetryClient = !isTelemetryDisabled && !isDebug ? 
  new PostHog(
    config.posthog.apiKey,
    {
      host: config.posthog.host,
      enableExceptionAutocapture: true 
     }
  ) : null;

if(telemetryClient) {
  console.log("superglue uses telemetry to understand how many users are using the platform. See self-hosting guide for more info.");
}

// Precompile the regex for better performance
const OPERATION_REGEX = /(?:query|mutation)\s+\w+\s*[({][\s\S]*?{([\s\S]*?){/;

export const extractOperationName = (query: string): string => {
  // Early return for invalid input
  if (!query) return 'unknown_query';

  const match = OPERATION_REGEX.exec(query);
  if (!match?.[1]) return 'unknown_query';

  // Split only the relevant captured group and take first word
  const firstWord = match[1].trim().split(/[\s({]/)[0];
  return firstWord || 'unknown_query';
};

export const telemetryMiddleware = (req, res, next) => {
  if(!telemetryClient) {
    return next();
  }

  if(req?.body?.query && !(req.body.query.includes("IntrospectionQuery") || req.body.query.includes("__schema"))) {
    const operation = extractOperationName(req.body.query);

    telemetryClient.capture({
        distinctId: req.orgId || sessionId,
        event: operation,
        properties: {
          query: req.body.query,
          orgId: req.orgId,
        }
      });
    }
  next();
};


const createCallProperties = (query: string, responseBody: any, isSelfHosted: boolean, operation: string) => {
  const properties: Record<string, any> = {};
  properties.isSelfHosted = isSelfHosted;
  properties.success = true;
  properties.operation = operation;
  properties.query = query;

  switch(operation) {
    case 'call':
      properties.endpointHost = responseBody?.singleResult?.data?.call?.config?.urlHost;
      properties.endpointPath = responseBody?.singleResult?.data?.call?.config?.urlPath;
      properties.apiConfigId = responseBody?.singleResult?.data?.call?.config?.id;
      properties.callMethod = responseBody?.singleResult?.data?.call?.config?.method;
      properties.documentationUrl = responseBody?.singleResult?.data?.call?.config?.documentationUrl;
      properties.authType = responseBody?.singleResult?.data?.call?.config?.authentication;
      properties.responseTimeMs = responseBody?.singleResult?.data?.call?.completedAt.getTime() - responseBody?.singleResult?.data?.call?.startedAt.getTime()
      break;
    default:
      break;
  }

  return properties;
}

export const handleQueryError = (errors: any[], query: string, orgId: string, requestContext: any) => {
  // in case of an error, we track the query and the error
  // we do not track the variables or the response
  // all errors are masked
  const isSelfHosted = checkIfSelfHosted(requestContext);
  const operation = extractOperationName(query);
  const properties = createCallProperties(query, requestContext.response?.body, isSelfHosted, operation);
  telemetryClient?.capture({
    distinctId: orgId || sessionId,
    event: operation + '_error',
    properties: {
      ...properties,
      orgId: orgId,
      errors: errors.map(e => ({
        message: e.message,
        path: e.path
      })),
      success: false
    },
    groups: {
      orgId: orgId
    }
  });
};

const handleQuerySuccess = (query: string, orgId: string, requestContext: any) => {
  const isSelfHosted = checkIfSelfHosted(requestContext);
  const distinctId = isSelfHosted ? `sh-inst-${requestContext.contextValue.datastore.storage?.tenant?.email}` : orgId;
  const operation = extractOperationName(query);
  const properties = createCallProperties(query, requestContext.response?.body, isSelfHosted, operation);

  telemetryClient?.capture({
    distinctId: distinctId,
    event: operation,
    properties: properties,
    groups: {
      orgId: orgId
    }
  }); 
};

export const createTelemetryPlugin = () => {
  return {
    requestDidStart: async () => ({
      willSendResponse: async (requestContext: any) => {
        const errors = requestContext.errors || 
          requestContext?.response?.body?.singleResult?.errors ||
          Object.values(requestContext?.response?.body?.singleResult?.data || {}).map((d: any) => d.error).filter(Boolean);

        if (telemetryClient) {
          if(errors && errors.length > 0) {
            console.error(errors);
            const orgId = requestContext.contextValue.orgId;
            handleQueryError(errors, requestContext.request.query, orgId, requestContext);
          } else {
            const orgId = requestContext.contextValue.orgId;
            handleQuerySuccess(requestContext.request.query, orgId, requestContext);
          }
        } else {
          // disabled telemetry
          if(errors && errors.length > 0) {
            console.error(errors);
          }
        }
      }
    })
  };
};


const checkIfSelfHosted = (requestContext: any): boolean => {
  const datastoreName = requestContext.contextValue.datastore.constructor.name;
  if(datastoreName !== 'RedisDataStore') {
    return true;
  }
  if (requestContext.contextValue.dataStore.storage?.tenant?.email) {
    return true;
  }
  if (requestContext.contextValue.dataStore.storage?.tenant?.emailEntrySkipped === true) {
    return true;
  }
  return false;
};
