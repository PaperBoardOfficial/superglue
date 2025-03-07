'use client'

import { ConfigCreateStepper } from '@/src/components/config-stepper/ConfigCreateStepper'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function CreateConfigPage() {
  const [showCreateStepper, setShowCreateStepper] = useState(true)
  const router = useRouter()

  return (
    <ConfigCreateStepper 
      open={showCreateStepper} 
      onOpenChange={setShowCreateStepper}
      mode="create"
    />
  )
}
