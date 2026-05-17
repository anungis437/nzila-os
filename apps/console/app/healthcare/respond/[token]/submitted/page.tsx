import { Card } from '@nzila/ui'

export default async function SubmittedPage() {
  return (
    <Card>
      <Card.Body className="space-y-2">
        <h1 className="text-2xl font-semibold">Thank you</h1>
        <p className="text-sm text-gray-700">
          Your anonymous response has been submitted.
        </p>
      </Card.Body>
    </Card>
  )
}
