import { createRouter, createWebHistory, type RouteMeta } from 'vue-router'
import FunnelView from '../views/FunnelView.vue'
import VideoView from '../views/VideoView.vue'
import PrivacyPolicyView from '../views/PrivacyPolicyView.vue'
import LegalNoticeView from '../views/LegalNoticeView.vue'
import BookingView from '../views/BookingView.vue'
import BookedView from '../views/BookedView.vue'
import NoSpaceView from '../views/NoSpaceView.vue'

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    description: string
    canonical: string
    ogTitle: string
    ogDescription: string
    ogUrl: string
    jsonLd?: object[]
  }
}

// ── Router ─────────────────────────────────────────────────────────────────────
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0, behavior: 'instant' }),
  routes: [
    {
      path: '/',
      alias: '/registro-vsl-tr',
      name: 'funnel',
      component: FunnelView,
      meta: {
        title: 'Aluvicopp | Ingeniería Estructural en Vidrio y Aluminio',
        description:
          'Especialistas en ingeniería estructural de vidrio templado y aluminio. Transformamos espacios corporativos, clínicas y residencias con precisión suiza. Agenda tu diagnóstico gratuito.',
        canonical: 'https://aluvicopp.com/',
        ogTitle: 'Aluvicopp | Ingeniería Estructural de Precisión',
        ogDescription:
          'Diseño, cálculo e instalación de estructuras de vidrio templado y aluminio de alto impacto. Plusvalía garantizada.',
        ogUrl: 'https://aluvicopp.com/',
      } satisfies RouteMeta,
    },
    {
      path: '/ver-video',
      name: 'video',
      component: VideoView,
      meta: {
        title: 'Mira el video | Aluvicopp — Paso 1 de 2',
        description: 'Descubre cómo la ingeniería estructural de precisión protege tu patrimonio. Video exclusivo de Aluvicopp.',
        canonical: 'https://aluvicopp.com/ver-video',
        ogTitle: 'Mira el video | Aluvicopp',
        ogDescription: 'Ve el video y agenda tu diagnóstico estructural gratuito con José de Aluvicopp.',
        ogUrl: 'https://aluvicopp.com/ver-video',
      } satisfies RouteMeta,
    },
    {
      path: '/agendar',
      name: 'booking',
      component: BookingView,
      meta: {
        title: 'Agenda tu Diagnóstico | Aluvicopp — Paso 2 de 2',
        description: 'Selecciona el día y hora para tu Diagnóstico Estructural gratuito con José de Aluvicopp.',
        canonical: 'https://aluvicopp.com/agendar',
        ogTitle: 'Agenda tu Diagnóstico | Aluvicopp',
        ogDescription: 'Elige tu horario y reserva tu Diagnóstico Estructural gratuito.',
        ogUrl: 'https://aluvicopp.com/agendar',
      } satisfies RouteMeta,
    },
    {
      path: '/cita-confirmada',
      name: 'booked',
      component: BookedView,
      meta: {
        title: 'Diagnóstico Confirmado | Aluvicopp',
        description: 'Tu diagnóstico estructural con Aluvicopp está confirmado. Revisa tu correo y prepárate.',
        canonical: 'https://aluvicopp.com/cita-confirmada',
        ogTitle: 'Diagnóstico Confirmado | Aluvicopp',
        ogDescription: 'Tu diagnóstico está reservado. Te contactaremos pronto.',
        ogUrl: 'https://aluvicopp.com/cita-confirmada',
      } satisfies RouteMeta,
    },
    {
      path: '/sin-espacio',
      name: 'no-space',
      component: NoSpaceView,
      meta: {
        title: 'Sin Cupos Disponibles | Aluvicopp',
        description: 'En este momento los cupos de diagnóstico estructural de Aluvicopp están completos. Te notificaremos cuando se libere un espacio.',
        canonical: 'https://aluvicopp.com/sin-espacio',
        ogTitle: 'Sin Cupos Disponibles | Aluvicopp',
        ogDescription: 'Los cupos de diagnóstico están completos. Te avisaremos cuando haya disponibilidad.',
        ogUrl: 'https://aluvicopp.com/sin-espacio',
      } satisfies RouteMeta,
    },
    {
      path: '/politicas-privacidad',
      name: 'privacy-policy',
      component: PrivacyPolicyView,
      meta: {
        title: 'Política de Privacidad | Aluvicopp',
        description: 'Política de privacidad de Aluvicopp. Información sobre el tratamiento de datos personales.',
        canonical: 'https://aluvicopp.com/politicas-privacidad',
        ogTitle: 'Política de Privacidad | Aluvicopp',
        ogDescription: 'Política de privacidad de Aluvicopp.',
        ogUrl: 'https://aluvicopp.com/politicas-privacidad',
      } satisfies RouteMeta,
    },
    {
      path: '/aviso-legal',
      name: 'legal-notice',
      component: LegalNoticeView,
      meta: {
        title: 'Aviso Legal | Aluvicopp',
        description: 'Aviso legal de Aluvicopp. Términos y condiciones de uso del sitio web.',
        canonical: 'https://aluvicopp.com/aviso-legal',
        ogTitle: 'Aviso Legal | Aluvicopp',
        ogDescription: 'Aviso legal de Aluvicopp.',
        ogUrl: 'https://aluvicopp.com/aviso-legal',
      } satisfies RouteMeta,
    },
  ],
})

// ── SEO dinámico por ruta ──────────────────────────────────────────────────────
const setMeta = (name: string, content: string) => {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el) }
  el.content = content
}

const setOgMeta = (property: string, content: string) => {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.content = content
}

const setCanonical = (href: string) => {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el) }
  el.href = href
}

router.afterEach((to) => {
  const meta = to.meta
  document.title = meta.title ?? 'Aluvicopp'
  setMeta('description', meta.description ?? '')
  setOgMeta('og:title', meta.ogTitle ?? meta.title ?? '')
  setOgMeta('og:description', meta.ogDescription ?? meta.description ?? '')
  setOgMeta('og:url', meta.ogUrl ?? '')
  setOgMeta('twitter:title', meta.ogTitle ?? meta.title ?? '')
  setOgMeta('twitter:description', meta.ogDescription ?? meta.description ?? '')
  setCanonical(meta.canonical ?? '')
})

// ── Router Guards ──────────────────────────────────────────────────────────────
const BOOKED_TTL_MS = 3 * 24 * 60 * 60 * 1000  // 3 días
const DISQ_TTL_MS   = 48 * 60 * 60 * 1000      // 48 horas

const readTimestamp = (key: string): number | null => {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

const isFresh = (key: string, ttl: number): boolean => {
  const ts = readTimestamp(key)
  if (ts === null) return false
  if (Date.now() - ts <= ttl) return true
  // Expirado → limpiar para que no quede colgado
  localStorage.removeItem(key)
  return false
}

const PUBLIC_ROUTES = ['privacy-policy', 'legal-notice']

router.beforeEach((to, from, next) => {
  const routeName = to.name as string
  if (PUBLIC_ROUTES.includes(routeName)) return next()

  const bookedFresh = isFresh('os_booked_at', BOOKED_TTL_MS)
  const disqFresh   = isFresh('os_disq_at',   DISQ_TTL_MS)

  // /cita-confirmada solo es accesible si tiene booking fresco
  if (routeName === 'booked') {
    if (!bookedFresh) return next({ name: 'funnel' })
    return next()
  }

  // Si tiene booking fresco → redirigir todo a /cita-confirmada
  if (bookedFresh) {
    return next({ name: 'booked' })
  }

  // Si está descalificado dentro de 48h → no permitir booking ni booked
  if (disqFresh && ['booking', 'booked'].includes(routeName)) {
    return next({ name: 'no-space' })
  }

  // /sin-espacio solo si está descalificado fresco (evita acceso directo)
  if (routeName === 'no-space' && !disqFresh) {
    return next({ name: 'funnel' })
  }

  next()
})

export default router
