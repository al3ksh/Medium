import { useUserColor, useUserAvatar } from '../contexts/AuthContext'

export default function UserList({ users, onUserClick, onUserContextMenu }) {
  const unique = [...new Set(users)]
  const getColor = useUserColor()
  const getAvatar = useUserAvatar()

  return (
    <div className="user-list">
      {unique.map((name, i) => (
        <div
          key={`${name}-${i}`}
          className="user-item clickable"
          onClick={(e) => onUserClick?.({ user: name, x: e.clientX + 10, y: e.clientY - 100 })}
          onContextMenu={(e) => { e.preventDefault(); onUserContextMenu?.(e, name) }}
        >
          <div className="user-avatar small" style={getAvatar(name) ? {} : { background: getColor(name) }}>
            {getAvatar(name) ? <img src={getAvatar(name)} alt="" /> : name[0]?.toUpperCase()}
          </div>
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}
