export default function UserList({ users }) {
  const unique = [...new Set(users)]

  return (
    <div className="user-list">
      {unique.map((name, i) => (
        <div key={`${name}-${i}`} className="user-item">
          <div className="user-avatar small">{name[0]?.toUpperCase()}</div>
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}
