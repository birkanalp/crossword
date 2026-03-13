import { Card, CardBody } from './Card'

interface MetricCardProps {
  title: string
  value: string | number
}

export function MetricCard({ title, value }: MetricCardProps) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-text-secondary mb-2">{title}</p>
        <p className="text-3xl font-bold text-text-primary">{value}</p>
      </CardBody>
    </Card>
  )
}
