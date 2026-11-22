import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyReceipt } from '@/app/actions/finance'

export const dynamic = 'force-dynamic'

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await verifyReceipt({ token: token || '' })

  if (!result || !result.valid) {
    return <InvalidReceipt />
  }

  return <ValidReceipt receipt={result} />
}

function ValidReceipt({ receipt }: { receipt: any }) {
  return (
    <main className="verify-page">
      <div className="verify-card">
        <div className="verify-header">
          <span className="badge valid">Valid receipt</span>
          <h1>Receipt Verification</h1>
        </div>
        <dl className="verify-details">
          <div><dt>Receipt number</dt><dd>{receipt.number}</dd></div>
          <div><dt>Business</dt><dd>{receipt.businessName}</dd></div>
          <div><dt>Payment date</dt><dd>{new Date(receipt.paidAt).toLocaleDateString('en-GB')}</dd></div>
          <div><dt>Amount</dt><dd><strong>{`UGX ${Number(receipt.amount).toLocaleString()}`}</strong></dd></div>
          <div><dt>Currency</dt><dd>UGX</dd></div>
          <div><dt>Status</dt><dd><span className={`status-pill status-${receipt.status}`}>{receipt.status}</span></dd></div>
          {receipt.reference && <div><dt>Reference</dt><dd>{receipt.reference}</dd></div>}
        </dl>
        <p className="verify-footer">
          This receipt was issued by {receipt.businessName}. A voided receipt
          is no longer a valid payment confirmation.
        </p>
      </div>
    </main>
  )
}

function InvalidReceipt() {
  return (
    <main className="verify-page">
      <div className="verify-card">
        <div className="verify-header">
          <span className="badge invalid">Invalid receipt</span>
          <h1>Receipt Verification</h1>
        </div>
        <p>We could not find a valid receipt matching this verification link.</p>
        <p>The link may be expired, tampered with, or the receipt may not exist.</p>
      </div>
    </main>
  )
}
