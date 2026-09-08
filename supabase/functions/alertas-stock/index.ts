// Central de Cobros — alerta diaria de stock bajo por email.
//
// La dispara un cron job de Supabase una vez por día (ver
// supabase/migrations/0004_alertas_stock_cron.sql). Por cada verdulería
// activa, revisa qué productos están por debajo de su stock mínimo y le
// manda un mail al dueño con la lista, usando Resend.
//
// Variables de entorno que necesita (se configuran como "secrets" de esta
// función en el panel de Supabase):
//   RESEND_API_KEY      - tu clave de Resend (resend.com)
//   ALERTAS_EMAIL_FROM  - remitente, ej: "Central de Cobros <alertas@tudominio.com>"
//                          (opcional: si no se configura, usa el remitente de
//                          prueba de Resend, que solo entrega a tu propio email)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const REMITENTE = Deno.env.get('ALERTAS_EMAIL_FROM') ?? 'Central de Cobros <onboarding@resend.dev>'

interface ProductoBajo {
  nombre: string
  unidad_medida: string
  stock: number
  stock_minimo: number
}

async function enviarEmail(destinatarios: string[], tenantNombre: string, productos: ProductoBajo[]) {
  const filas = productos
    .map((p) => `<li>${p.nombre}: ${p.stock} ${p.unidad_medida} (mínimo ${p.stock_minimo})</li>`)
    .join('')

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: destinatarios,
      subject: `⚠ Stock bajo en ${tenantNombre}`,
      html: `<p>Estos productos están por debajo del stock mínimo:</p><ul>${filas}</ul><p>— Central de Cobros</p>`
    })
  })

  return respuesta.ok
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: tenants, error: errorTenants } = await supabase
    .from('tenants')
    .select('id, nombre')
    .eq('estado', 'activo')

  if (errorTenants) {
    return new Response(errorTenants.message, { status: 500 })
  }

  let emailsEnviados = 0

  for (const tenant of tenants ?? []) {
    const { data: productos } = await supabase
      .from('productos')
      .select('id, nombre, unidad_medida, stock_minimo')
      .eq('tenant_id', tenant.id)
      .eq('activo', true)
      .not('stock_minimo', 'is', null)

    if (!productos || productos.length === 0) continue

    const { data: stockRows } = await supabase.from('stock_actual').select('producto_id, stock').eq('tenant_id', tenant.id)
    const stockPorProducto = new Map((stockRows ?? []).map((r) => [r.producto_id, r.stock as number]))

    const bajos: ProductoBajo[] = productos
      .filter((p) => (stockPorProducto.get(p.id) ?? 0) < (p.stock_minimo ?? 0))
      .map((p) => ({
        nombre: p.nombre,
        unidad_medida: p.unidad_medida,
        stock: stockPorProducto.get(p.id) ?? 0,
        stock_minimo: p.stock_minimo as number
      }))

    if (bajos.length === 0) continue

    const { data: duenos } = await supabase.from('perfiles').select('id').eq('tenant_id', tenant.id).eq('rol', 'dueno')
    if (!duenos || duenos.length === 0) continue

    const destinatarios: string[] = []
    for (const d of duenos) {
      const { data: userData } = await supabase.auth.admin.getUserById(d.id)
      if (userData?.user?.email) destinatarios.push(userData.user.email)
    }
    if (destinatarios.length === 0) continue

    const enviado = await enviarEmail(destinatarios, tenant.nombre, bajos)
    if (enviado) emailsEnviados++
  }

  return new Response(JSON.stringify({ emailsEnviados }), { headers: { 'Content-Type': 'application/json' } })
})
