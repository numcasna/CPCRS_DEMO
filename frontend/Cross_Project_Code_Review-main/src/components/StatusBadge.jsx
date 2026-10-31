const STYLES = {
  Open: 'bg-purple-100 text-purple-700',
  'In Progress': 'bg-indigo-100 text-indigo-700',
  Resolved: 'bg-green-100 text-green-700',
  Reopened: 'bg-orange-100 text-orange-700',
  Rejected: 'bg-gray-200 text-gray-600',
  Closed: 'bg-gray-800 text-white',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
