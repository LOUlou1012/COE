import { createSupabaseServerClient } from '@/lib/supabase/server'
import { transporter } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createSupabaseServerClient()

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recentEvents } = await supabase
    .from('events')
    .select('title, date, start_time, location, status, profiles(full_name)')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })

  if (!recentEvents || recentEvents.length === 0) {
    return NextResponse.json({ message: 'Tidak ada update dalam 24 jam terakhir' })
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('email, full_name')
    .neq('email', null)

  if (!users || users.length === 0) {
    return NextResponse.json({ message: 'Tidak ada penerima' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventRows = recentEvents.map((e: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${e.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
        ${new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${e.start_time ?? '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${e.location ?? '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${e.status === 'approved' ? 'Approved' : 'Need Review'}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#111827">COE Online — Daily Update</h2>
      <p style="color:#6b7280">
        Berikut adalah log pembaruan event dalam 24 jam terakhir 
        (${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#374151">Judul</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#374151">Tanggal</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#374151">Waktu</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#374151">Lokasi</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#374151">Status</th>
          </tr>
        </thead>
        <tbody>${eventRows}</tbody>
      </table>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">
        Email ini dikirim otomatis oleh sistem COE Online.
      </p>
    </div>
  `

  const emails = users.map((u) => u.email).filter(Boolean) as string[]

  await transporter.sendMail({
    from: `"COE Online" <${process.env.SMTP_FROM}>`,
    to: emails.join(','),
    subject: `COE Online — Daily Update ${new Date().toLocaleDateString('id-ID')}`,
    html,
  })

  await supabase.from('audit_trail').insert({
    action: 'email_blast',
    module: 'notifications',
    description: `Email blast dikirim ke ${emails.length} user`,
  })

  return NextResponse.json({ message: `Email blast terkirim ke ${emails.length} user` })
}