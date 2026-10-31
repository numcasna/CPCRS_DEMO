export default function Avatar({ user, size = 32 }) {
  if (!user) {
    return <span className="avatar avatar-fallback" style={{ width: size, height: size }}>?</span>
  }
  if (user.avatar) {
    return <img src={user.avatar} alt={user.name} title={user.name} className="avatar avatar-image" style={{ width: size, height: size }} />
  }
  return (
    <span className="avatar" style={{ width: size, height: size, backgroundColor: user.color || '#8250df' }} title={user.name}>
      {user.initials || user.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
    </span>
  )
}
