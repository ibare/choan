// Alt-key distance labels shown between selected element and neighbors.

interface DistanceLabel {
  x: number
  y: number
  text: string
}

interface DistanceLabelsProps {
  labels: DistanceLabel[]
}

export default function DistanceLabels({ labels }: DistanceLabelsProps) {
  if (labels.length === 0) return null
  return (
    <>
      {labels.map((label, i) => (
        <div key={i} style={{
          position: 'absolute', left: label.x, top: label.y,
          transform: 'translate(-50%, -50%)',
          background: 'rgba(249,115,22,0.92)', color: '#fff',
          padding: '2px 6px', borderRadius: 4, fontSize: 11,
          fontWeight: 700, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>{label.text}</div>
      ))}
    </>
  )
}
