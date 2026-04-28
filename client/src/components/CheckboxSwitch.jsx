import { Check } from 'lucide-react'

export default function CheckboxSwitch({ checked, onChange }) {
  return (
    <div className={`medium-switch ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)}>
      <div className="medium-switch-handle">
        {checked && <Check size={12} className="medium-switch-icon" />}
      </div>
    </div>
  )
}
