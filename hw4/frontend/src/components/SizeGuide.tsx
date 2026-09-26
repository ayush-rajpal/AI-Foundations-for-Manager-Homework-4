// US size guide (unisex, body measurements in inches), shown in the size pop-up and on
// product pages. The catalogue has no per-product measurements, so it's labeled as a
// general guide.

const US_SIZE_GUIDE: { size: string; chest: string; waist: string; neck: string; us: string }[] = [
  { size: 'XS', chest: '31–34', waist: '26–28', neck: '13–13.5', us: "Men's XS · Women's S (4–6)" },
  { size: 'S', chest: '34–37', waist: '28–30', neck: '14–14.5', us: "Men's S · Women's M (8–10)" },
  { size: 'M', chest: '38–41', waist: '31–33', neck: '15–15.5', us: "Men's M · Women's L (12–14)" },
  { size: 'L', chest: '42–45', waist: '34–36', neck: '16–16.5', us: "Men's L · Women's XL (16)" },
  { size: 'XL', chest: '46–49', waist: '37–40', neck: '17–17.5', us: "Men's XL · Women's XXL (18–20)" },
  { size: 'XXL', chest: '50–53', waist: '41–44', neck: '18–18.5', us: "Men's XXL · Women's 3X (22–24)" },
]

export default function SizeGuide({ highlight }: { highlight?: string }) {
  return (
    <div className="size-guide">
      <p className="size-guide-title">
        <strong>US size guide</strong> · unisex fit · body measurements in inches
      </p>
      <div className="size-guide-scroll">
        <table>
          <thead>
            <tr>
              <th>Size</th>
              <th>Chest</th>
              <th>Waist</th>
              <th>Neck</th>
              <th>Usually fits</th>
            </tr>
          </thead>
          <tbody>
            {US_SIZE_GUIDE.map((row) => (
              <tr key={row.size} className={row.size === highlight ? 'highlight' : undefined}>
                <td>{row.size}</td>
                <td>{row.chest}</td>
                <td>{row.waist}</td>
                <td>{row.neck}</td>
                <td>{row.us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="size-guide-tips">
        <li>
          <strong>How to measure:</strong> chest around the fullest part, under the arms; waist around your natural
          waistline; neck around the base of the neck. Keep the tape snug but not tight.
        </li>
        <li>All styles are cut unisex (men's sizing). Women usually go one size down from their usual women's size.</li>
        <li>Between sizes, or want a relaxed fit? Go one size up. Hoodies and crewnecks fit roomier than T-shirts.</li>
        <li>This is a general US guide; exact fit varies slightly by style and brand.</li>
      </ul>
    </div>
  )
}
