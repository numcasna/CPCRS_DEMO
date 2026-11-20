const STYLES = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-blue-100 text-blue-700',
  Informational: 'bg-gray-100 text-gray-700',
}

const DOT = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-blue-500',
  Informational: 'bg-gray-500',
}

export default function SeverityBadge({ severity }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[severity] || STYLES.Informational}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOT[severity] || DOT.Informational}`} />
      {severity}
    </span>
  )
}
