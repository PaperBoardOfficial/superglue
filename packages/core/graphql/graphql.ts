import fs from 'fs';
import { callResolver } from './resolvers/call.js';
import { deleteApiResolver, deleteExtractResolver, deleteTransformResolver } from './resolvers/delete.js';
import { extractResolver } from './resolvers/extract.js';
import { generateSchemaResolver } from './resolvers/generate.js';
import { getApiResolver, getExtractResolver, getRunResolver, getTransformResolver } from './resolvers/get.js';
import { listApisResolver, listExtractsResolver, listRunsResolver, listTransformsResolver } from './resolvers/list.js';
import { JSONResolver, JSONSchemaResolver, JSONataResolver } from './resolvers/scalars.js';
import { transformResolver } from './resolvers/transform.js';
import { upsertApiResolver, upsertExtractResolver, upsertTransformResolver } from './resolvers/upsert.js';

export const resolvers = {
    Query: {
        listRuns: listRunsResolver,
        getRun: getRunResolver,  
        listApis: listApisResolver,
        getApi: getApiResolver,
        listTransforms: listTransformsResolver,
        getTransform: getTransformResolver,
        listExtracts: listExtractsResolver,
        getExtract: getExtractResolver,
        generateSchema: generateSchemaResolver
    },
    Mutation: {
        call: callResolver,
        extract: extractResolver,
        transform: transformResolver,
        upsertApi: upsertApiResolver,
        deleteApi: deleteApiResolver,
        upsertExtraction: upsertExtractResolver,
        deleteExtraction: deleteExtractResolver,
        upsertTransformation: upsertTransformResolver,
        deleteTransformation: deleteTransformResolver,
    },
    JSON: JSONResolver,
    JSONSchema: JSONSchemaResolver,
    JSONata: JSONataResolver,
    ConfigType: {
        __resolveType(obj: any, context: any, info: any) {
            // Get the parent field name from the path
            const parentField = info.path.prev.key;
            
            switch (parentField) {
                case 'call':
                    return 'ApiConfig';
                case 'extract':
                    return 'ExtractConfig';
                case 'transform':
                    return 'TransformConfig';
                default:
                    return 'ApiConfig';
            }
        }
    }    
  };
  export const typeDefs = fs.readFileSync('../../api.graphql', 'utf8');
  