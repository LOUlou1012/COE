"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function EmailBlastButton() {
  const [loading, setLoading] = useState(false)

  const handleBlast = async () => {
    setLoading(true)

    try {
      const res = await fetch("/api/email-blast", {
        method: "POST",
      })

      const data = await res.json()
      alert(data.message)
    } catch (err) {
      alert("Gagal kirim email blast")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleBlast} disabled={loading}>
      {loading ? "Sending..." : "Send Email Blast"}
    </Button>
  )
}