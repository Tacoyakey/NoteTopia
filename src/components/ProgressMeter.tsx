export function ProgressMeter({
  percent,
  label,
}: {
  percent: number
  label?: string
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className="progress-meter">
      <div
        className="convert-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
      >
        <div className="convert-bar-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="convert-bar-pct">{value}%</span>
      {label ? <p className="convert-status">{label}</p> : null}
    </div>
  )
}
