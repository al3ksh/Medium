import { Check } from 'lucide-react'

export default function CheckboxSwitch({ checked, onChange }) {
  return (
    <div className={`discord-switch ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)}>
      <div className="discord-switch-handle">
        {checked && <Check size={12} className="discord-switch-icon" />}
      </div>
    </div>
  )
}
