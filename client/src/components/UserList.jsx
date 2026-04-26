import { useUserColor } from '../contexts/AuthContext'

export default function UserList({ users, onUserClick }) {
  const unique = [...new Set(users)]
  const getColor = useUserColor()

  return (
    <div className="user-list">
      {unique.map((name, i) => (
        <div
          key={`${name}-${i}`}
          className="user-item clickable"
          onClick={(e) => onUserClick?.({ user: name, x: e.clientX + 10, y: e.clientY - 100 })}
        >
          <div className="user-avatar small" style={{ background: getColor(name) }}>
            {name[0]?.toUpperCase()}
          </div>
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}
