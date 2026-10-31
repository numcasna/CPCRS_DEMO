import Avatar from './Avatar'
import StatusBadge from './StatusBadge'
import { users, userById } from '../data/mockData'

function entryPerson(entry) {
  if (entry.byId) return userById(entry.byId)
  const by = String(entry.by || '')
  return userById(entry.by) || users.find((user) => user.name === by) || { name: by || 'System', initials: by ? by.split(' ').map((n) => n[0]).join('').slice(0, 2) : 'SY', color: '#656d76' }
}

export default function FeedbackThread({ finding, compact = false }) {
  const history = finding?.history || finding?.statusHistory || []
  const entries = []

  if (finding?.recommendation) {
    entries.push({
      id: 'initial-recommendation',
      by: finding.reviewer || 'Admin',
      byId: finding.reviewer,
      date: finding.created,
      feedback: finding.recommendation,
      action: 'Finding created',
      type: 'admin',
      attachments: [],
    })
  }

  history.forEach((item, index) => {
    if (!item.feedback && !item.attachments?.length) return
    entries.push({
      ...item,
      id: `${item.updatedAt || item.date || index}-${index}`,
      action: item.to || item.action,
      type: item.byRole || (['Resolved', 'In Progress'].includes(item.to) && item.by === finding.assignee ? 'user' : 'admin'),
    })
  })

  if (!entries.length) {
    return <div className="thread-empty">No feedback messages have been recorded yet.</div>
  }

  return (
    <div className={`feedback-thread ${compact ? 'feedback-thread-compact' : ''}`}>
      {entries.map((entry, index) => {
        const person = entryPerson(entry)
        const statusAction = ['Reopened', 'Rejected', 'Closed', 'Resolved'].includes(entry.to)
        return (
          <article className="thread-entry" key={entry.id}>
            <div className="thread-avatar"><Avatar user={person} size={34} /></div>
            <div className="thread-body">
              <div className="thread-meta">
                <strong>{person?.name || entry.by || 'System'}</strong>
                {entry.to === 'Reopened' && <span className="thread-action thread-action-reopened">Reopened</span>}
                {entry.to === 'Rejected' && <span className="thread-action">Rejected</span>}
                {entry.to === 'Closed' && <span className="thread-action">Closed</span>}
                {entry.to === 'Resolved' && <span className="thread-action">Resolved</span>}
                {!statusAction && entry.action && <span className="thread-action">{entry.action}</span>}
                <span className="thread-date">{entry.date || entry.updatedAt || '—'}</span>
              </div>
              {entry.from && entry.to && statusAction && (
                <div className="thread-status"><StatusBadge status={entry.from} /><span>→</span><StatusBadge status={entry.to} /></div>
              )}
              <p className="thread-message">{entry.feedback}</p>
              {entry.attachments?.length > 0 && (
                <div className="thread-attachments">
                  {entry.attachments.map((file) => (
                    <a key={file.name} href={file.dataUrl} download={file.name}>{file.name}</a>
                  ))}
                </div>
              )}
            </div>
            {index < entries.length - 1 && <div className="thread-line" aria-hidden="true" />}
          </article>
        )
      })}
    </div>
  )
}
