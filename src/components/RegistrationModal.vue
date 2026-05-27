<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode, AsYouType } from 'libphonenumber-js'
import { useRouter } from 'vue-router'
import { getStoredFbParams } from '@/utils/fbclid'
const router = useRouter()

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

// ── Países ─────────────────────────────────────────────────────────────────────
interface Country { code: string; name: string; dial: string; flag: string }

const flagEmoji = (code: string) =>
  [...code.toUpperCase()].map(c => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))).join('')

const PRIORITY = ['EC', 'CO', 'PE', 'MX', 'AR', 'CL', 'VE', 'BO', 'PY', 'UY', 'GT', 'HN', 'SV', 'CR', 'PA', 'DO', 'CU', 'US', 'ES']

const nameMap: Record<string, string> = {
  EC: 'Ecuador', CO: 'Colombia', PE: 'Perú', MX: 'México', AR: 'Argentina',
  CL: 'Chile', VE: 'Venezuela', BO: 'Bolivia', PY: 'Paraguay', UY: 'Uruguay',
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador', CR: 'Costa Rica',
  PA: 'Panamá', DO: 'Rep. Dominicana', CU: 'Cuba', US: 'Estados Unidos',
  ES: 'España', BR: 'Brasil', PT: 'Portugal', FR: 'Francia', DE: 'Alemania',
  IT: 'Italia', GB: 'Reino Unido', CA: 'Canadá', AU: 'Australia', JP: 'Japón',
  CN: 'China', IN: 'India',
}

const allCountries: Country[] = getCountries()
  .map(code => ({
    code,
    name: nameMap[code] ?? code,
    dial: '+' + getCountryCallingCode(code),
    flag: flagEmoji(code),
  }))

const priorityList = PRIORITY
  .map(code => allCountries.find(c => c.code === code))
  .filter(Boolean) as Country[]

const otherList = allCountries
  .filter(c => !PRIORITY.includes(c.code))
  .sort((a, b) => a.name.localeCompare(b.name))

const countries = [...priorityList, { code: '---', name: '', dial: '', flag: '' }, ...otherList]

// ── Estado del formulario ─────────────────────────────────────────────────────
const step = ref(1) // 1 = cualificación, 2 = datos de contacto
const selectedCountry = ref<Country>(priorityList[0])
const dropdownOpen = ref(false)
const countrySearch = ref('')
const submitting = ref(false)
const disqualified = ref(false)

const form = ref({
  enfoque: '',
  propiedad: '',
  urgencia: '',
  calidad: '',
  nombre: '',
  apellido: '',
  email: '',
  phone: '',
})

const errors = ref<Record<string, string>>({})
const touched = ref<Record<string, boolean>>({})

// ── Phone ──────────────────────────────────────────────────────────────────────
const formattedPhone = computed(() => {
  if (!form.value.phone) return ''
  const formatter = new AsYouType(selectedCountry.value.code as any)
  return formatter.input(form.value.phone)
})

const phoneValid = computed(() => {
  const full = selectedCountry.value.dial + form.value.phone.replace(/\s/g, '')
  const parsed = parsePhoneNumberFromString(full, selectedCountry.value.code as any)
  return parsed?.isValid() ?? false
})

const parsedPhoneE164 = computed(() => {
  const full = selectedCountry.value.dial + form.value.phone.replace(/\s/g, '')
  const parsed = parsePhoneNumberFromString(full, selectedCountry.value.code as any)
  return parsed?.format('E.164') ?? ''
})

// ── Qualification logic ────────────────────────────────────────────────────────
const qualifiesEnfoque = computed(() => form.value.enfoque === 'valor')
const isDisqualified = computed(() => {
  if (form.value.enfoque === 'economico') return true
  if (form.value.calidad === 'temporal') return true
  return false
})

const showDisqualification = ref(false)

const advanceToStep2 = () => {
  if (!form.value.enfoque) {
    errors.value.enfoque = 'Selecciona una opción'
    return
  }
  if (form.value.enfoque === 'economico') {
    disqualified.value = true
    showDisqualification.value = true
    return
  }
  if (!form.value.propiedad) {
    errors.value.propiedad = 'Selecciona una opción'
    return
  }
  if (!form.value.urgencia) {
    errors.value.urgencia = 'Selecciona cuándo planeas iniciar'
    return
  }
  if (!form.value.calidad) {
    errors.value.calidad = 'Selecciona una opción'
    return
  }
  if (form.value.calidad === 'temporal') {
    disqualified.value = true
    showDisqualification.value = true
    return
  }
  step.value = 2
}

const goBackToStep1 = () => {
  showDisqualification.value = false
  disqualified.value = false
  form.value.enfoque = ''
  form.value.propiedad = ''
  form.value.urgencia = ''
  form.value.calidad = ''
  errors.value = {}
  step.value = 1
}

// ── Validaciones paso 2 ────────────────────────────────────────────────────────
const validators: Record<string, (v: string) => string | null> = {
  nombre: v => v.trim().length < 2 ? 'Ingresa tu nombre' : null,
  apellido: v => v.trim().length < 2 ? 'Ingresa tu apellido' : null,
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'Email inválido',
  phone: () => phoneValid.value ? null : 'Número inválido para el país seleccionado',
}

const validate = () => {
  const e: Record<string, string> = {}
  for (const [field, fn] of Object.entries(validators)) {
    const msg = fn(form.value[field as keyof typeof form.value])
    if (msg) e[field] = msg
  }
  errors.value = e
  return Object.keys(e).length === 0
}

const onBlur = (field: string) => {
  touched.value[field] = true
  const msg = validators[field]?.(form.value[field as keyof typeof form.value])
  if (msg) errors.value[field] = msg
  else delete errors.value[field]
}

const onPhoneInput = (e: Event) => {
  const raw = (e.target as HTMLInputElement).value.replace(/[^\d\s\-\(\)]/g, '')
  form.value.phone = raw
}

// ── Dropdown ---
const filteredCountries = computed(() => {
  const q = countrySearch.value.toLowerCase()
  if (!q) return countries
  return countries.filter(c =>
    c.code !== '---' && (c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q))
  )
})

const selectCountry = (c: Country) => {
  if (c.code === '---') return
  selectedCountry.value = c
  dropdownOpen.value = false
  countrySearch.value = ''
  form.value.phone = ''
}

const handleClickOutside = (e: MouseEvent) => {
  const el = document.querySelector('.rmodal__phone-wrap')
  if (el && !el.contains(e.target as Node)) dropdownOpen.value = false
}

// ── Submit ────────────────────────────────────────────────────────────────────
const handleSubmit = async () => {
  touched.value = { nombre: true, apellido: true, email: true, phone: true }
  if (!validate()) return

  submitting.value = true

  const leadEventId = `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const enfoqueLabel: Record<string, string> = {
    valor: 'Incrementar valor e imagen',
    economico: 'Buscar presupuesto más económico',
  }
  const propiedadLabel: Record<string, string> = {
    oficina: 'Oficina / Centro de negocios',
    clinica: 'Clínica o local comercial',
    residencia: 'Residencia de alto estándar',
    otro: 'Otro',
  }
  const urgenciaLabel: Record<string, string> = {
    inmediato: 'Este mes — urgencia alta',
    '1-3': 'En 1 a 3 meses',
    '3-6': 'En 3 a 6 meses',
    explorando: 'Solo explorando opciones',
  }
  const calidadLabel: Record<string, string> = {
    premium: 'Sí, busca calidad e ingeniería de largo plazo',
    temporal: 'No, busca algo temporal',
  }

  const tags = [
    'aluvicopp',
    'funnel-registro',
    `enfoque-${form.value.enfoque}`,
    `propiedad-${form.value.propiedad}`,
    `urgencia-${form.value.urgencia}`,
    `calidad-${form.value.calidad}`,
    form.value.urgencia === 'inmediato' ? 'urgente' : '',
  ].filter(Boolean)

  const nota = [
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    'ALUVICOPP — Registro Inicial',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `👤 ${form.value.nombre.trim()} ${form.value.apellido.trim()}`,
    `📧 ${form.value.email.trim().toLowerCase()}`,
    `📱 ${parsedPhoneE164.value}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `🎯 Enfoque: ${enfoqueLabel[form.value.enfoque] ?? form.value.enfoque}`,
    `🏗 Propiedad: ${propiedadLabel[form.value.propiedad] ?? form.value.propiedad}`,
    `⏱ Urgencia: ${urgenciaLabel[form.value.urgencia] ?? form.value.urgencia}`,
    `🔧 Calidad: ${calidadLabel[form.value.calidad] ?? form.value.calidad}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `✅ CUALIFICADO — Accede al video VSL`,
  ].join('\n')

  const payload = {
    nombre: form.value.nombre.trim(),
    apellido: form.value.apellido.trim(),
    email: form.value.email.trim().toLowerCase(),
    telefono: parsedPhoneE164.value,
    telefonoDisplay: selectedCountry.value.dial + ' ' + formattedPhone.value,
    enfoque: form.value.enfoque,
    enfoqueLabel: enfoqueLabel[form.value.enfoque] ?? form.value.enfoque,
    propiedad: form.value.propiedad,
    propiedadLabel: propiedadLabel[form.value.propiedad] ?? form.value.propiedad,
    urgencia: form.value.urgencia,
    urgenciaLabel: urgenciaLabel[form.value.urgencia] ?? form.value.urgencia,
    calidad: form.value.calidad,
    calidadLabel: calidadLabel[form.value.calidad] ?? form.value.calidad,
    tags,
    nota,
    source: 'aluvicopp-web',
    timestamp: new Date().toISOString(),
    event_id: leadEventId,
    ...getStoredFbParams(),
  }

  console.info('[Aluvicopp Registro]', payload)

  await fetch('https://services.leadconnectorhq.com/hooks/hV6oVhNySQrHdT6JLqUW/webhook-trigger/M8FUKbXoYlshxr7P5U3g', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})

  ;(window as any).fbq?.('track', 'Lead',
    { content_name: 'diagnostico-estructural' },
    { eventID: leadEventId }
  )

  localStorage.setItem('os_contact', JSON.stringify({
    nombre: form.value.nombre.trim(),
    email: form.value.email.trim().toLowerCase(),
    phone: parsedPhoneE164.value,
    timestamp: Date.now(),
  }))
  ;(window as any).fbq?.('track', 'CompleteRegistration')

  submitting.value = false
  emit('close')

  router.push('/ver-video')
}

// ── Keyboard trap ─────────────────────────────────────────────────────────────
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.open, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
  if (val) {
    step.value = 1
    disqualified.value = false
    showDisqualification.value = false
    form.value = { enfoque: '', propiedad: '', urgencia: '', calidad: '', nombre: '', apellido: '', email: '', phone: '' }
    errors.value = {}
    touched.value = {}
  }
})

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

watch(dropdownOpen, open => {
  if (open) {
    setTimeout(() => document.querySelector<HTMLInputElement>('.rmodal__country-search')?.focus(), 50)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="rmodal-fade">
      <div v-if="props.open" class="rmodal-overlay" @click.self="$emit('close')" role="dialog" aria-modal="true" aria-labelledby="rmodal-title">

        <div class="rmodal">

          <!-- Close -->
          <button class="rmodal__close" @click="$emit('close')" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <!-- STEP 1 — Qualification -->
          <template v-if="step === 1 && !showDisqualification">
            <div class="rmodal__header">
              <p class="rmodal__eyebrow">Diagnóstico estructural gratuito</p>
              <h2 id="rmodal-title" class="rmodal__title">
                Cuéntanos sobre<br><span class="rmodal__title-accent">tu proyecto</span>
              </h2>
              <p class="rmodal__subtitle">4 preguntas rápidas para entender si podemos ayudarte — 45 segundos.</p>
            </div>

            <form class="rmodal__form" @submit.prevent="advanceToStep2" novalidate>

              <!-- Q1 — Enfoque -->
              <fieldset class="rmodal__fieldset" :class="{ 'has-error': errors.enfoque }">
                <legend class="rmodal__legend">
                  <span class="rmodal__q-num">01</span>
                  ¿Cuál es el enfoque principal de tu proyecto?
                </legend>
                <div class="rmodal__options">
                  <label class="rmodal__option" :class="{ selected: form.enfoque === 'valor', 'rmodal__option--warn': form.enfoque === 'economico' }">
                    <input type="radio" v-model="form.enfoque" value="valor" hidden @change="errors.enfoque = ''" />
                    <span class="rmodal__option-radio" aria-hidden="true" />
                    <span class="rmodal__option-label">Incrementar el valor y la imagen de mi propiedad / negocio</span>
                  </label>
                  <label class="rmodal__option" :class="{ selected: form.enfoque === 'economico', 'rmodal__option--danger': form.enfoque === 'economico' }">
                    <input type="radio" v-model="form.enfoque" value="economico" hidden @change="errors.enfoque = ''" />
                    <span class="rmodal__option-radio" aria-hidden="true" />
                    <span class="rmodal__option-label">Buscar el presupuesto más económico del mercado</span>
                  </label>
                </div>
                <span v-if="errors.enfoque" class="rmodal__error">{{ errors.enfoque }}</span>
              </fieldset>

              <!-- Q2 — Propiedad -->
              <fieldset class="rmodal__fieldset" :class="{ 'has-error': errors.propiedad }">
                <legend class="rmodal__legend">
                  <span class="rmodal__q-num">02</span>
                  ¿Qué tipo de propiedad vamos a intervenir?
                </legend>
                <div class="rmodal__options">
                  <label v-for="opt in [
                    { value: 'oficina', label: 'Oficina / Centro de negocios' },
                    { value: 'clinica', label: 'Clínica o local comercial' },
                    { value: 'residencia', label: 'Residencia de alto estándar' },
                    { value: 'otro', label: 'Otro' },
                  ]" :key="opt.value" class="rmodal__option" :class="{ selected: form.propiedad === opt.value }">
                    <input type="radio" :value="opt.value" v-model="form.propiedad" hidden @change="errors.propiedad = ''" />
                    <span class="rmodal__option-radio" aria-hidden="true" />
                    <span class="rmodal__option-label">{{ opt.label }}</span>
                  </label>
                </div>
                <span v-if="errors.propiedad" class="rmodal__error">{{ errors.propiedad }}</span>
              </fieldset>

              <!-- Q3 — Urgencia -->
              <fieldset class="rmodal__fieldset" :class="{ 'has-error': errors.urgencia }">
                <legend class="rmodal__legend">
                  <span class="rmodal__q-num">03</span>
                  ¿Cuándo planeas iniciar la ejecución de la obra?
                </legend>
                <div class="rmodal__options">
                  <label v-for="opt in [
                    { value: 'inmediato', label: 'Este mes — urgencia alta' },
                    { value: '1-3', label: 'En los próximos 1 a 3 meses' },
                    { value: '3-6', label: 'En 3 a 6 meses' },
                    { value: 'explorando', label: 'Solo estoy explorando opciones' },
                  ]" :key="opt.value" class="rmodal__option" :class="{ selected: form.urgencia === opt.value }">
                    <input type="radio" :value="opt.value" v-model="form.urgencia" hidden @change="errors.urgencia = ''" />
                    <span class="rmodal__option-radio" aria-hidden="true" />
                    <span class="rmodal__option-label">{{ opt.label }}</span>
                  </label>
                </div>
                <span v-if="errors.urgencia" class="rmodal__error">{{ errors.urgencia }}</span>
              </fieldset>

              <!-- Q4 — Calidad -->
              <fieldset class="rmodal__fieldset" :class="{ 'has-error': errors.calidad }">
                <legend class="rmodal__legend">
                  <span class="rmodal__q-num">04</span>
                  ¿Entiendes que Aluvicopp trabaja bajo ingeniería técnica premium con materiales certificados para durar 20 años?
                </legend>
                <div class="rmodal__options">
                  <label class="rmodal__option" :class="{ selected: form.calidad === 'premium' }">
                    <input type="radio" v-model="form.calidad" value="premium" hidden @change="errors.calidad = ''" />
                    <span class="rmodal__option-radio" aria-hidden="true" />
                    <span class="rmodal__option-label">Sí, busco esa calidad e ingeniería de largo plazo</span>
                  </label>
                  <label class="rmodal__option" :class="{ selected: form.calidad === 'temporal', 'rmodal__option--danger': form.calidad === 'temporal' }">
                    <input type="radio" v-model="form.calidad" value="temporal" hidden @change="errors.calidad = ''" />
                    <span class="rmodal__option-radio" aria-hidden="true" />
                    <span class="rmodal__option-label">No, busco algo temporal y económico</span>
                  </label>
                </div>
                <span v-if="errors.calidad" class="rmodal__error">{{ errors.calidad }}</span>
              </fieldset>

              <button type="submit" class="rmodal__submit">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                CONTINUAR
              </button>
            </form>
          </template>

          <!-- DISQUALIFICATION SCREEN -->
          <template v-if="showDisqualification">
            <div class="rmodal__disq">
              <div class="rmodal__disq-icon" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h2 class="rmodal__disq-title">Tu proyecto necesita otro enfoque</h2>
              <p class="rmodal__disq-text">
                En Aluvicopp trabajamos exclusivamente con ingeniería estructural de precisión y
                materiales certificados para durar décadas. Nuestros proyectos están diseñados para
                clientes que priorizan <strong>calidad, seguridad y plusvalía a largo plazo</strong>
                sobre el precio inicial.
              </p>
              <p class="rmodal__disq-text">
                Si en el futuro buscas una solución definitiva con respaldo técnico, estaremos aquí para ti.
              </p>
              <button class="rmodal__disq-btn" @click="goBackToStep1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                Revisar mis respuestas
              </button>
              <hr class="rmodal__disq-divider" />
              <p class="rmodal__disq-legal">
                Si tu proyecto es de gran escala y crees que tu caso es una excepción,
                <a href="#" @click.prevent="emit('close')">contáctanos directamente</a>.
              </p>
            </div>
          </template>

          <!-- STEP 2 — Contact Data -->
          <template v-if="step === 2">
            <div class="rmodal__header">
              <p class="rmodal__eyebrow">Paso final</p>
              <h2 id="rmodal-title" class="rmodal__title">
                Completa tus datos<br><span class="rmodal__title-accent">para acceder al video</span>
              </h2>
              <p class="rmodal__subtitle">Cupos limitados — recibe tu sesión de diagnóstico estructural sin costo.</p>
            </div>

            <form class="rmodal__form" @submit.prevent="handleSubmit" novalidate>

              <div class="rmodal__row">
                <div class="rmodal__field" :class="{ 'has-error': touched.nombre && errors.nombre }">
                  <label for="r-nombre">Nombre</label>
                  <input
                    id="r-nombre"
                    v-model="form.nombre"
                    type="text"
                    placeholder="Juan"
                    autocomplete="given-name"
                    @blur="onBlur('nombre')"
                  />
                  <span v-if="touched.nombre && errors.nombre" class="rmodal__error">{{ errors.nombre }}</span>
                </div>

                <div class="rmodal__field" :class="{ 'has-error': touched.apellido && errors.apellido }">
                  <label for="r-apellido">Apellido</label>
                  <input
                    id="r-apellido"
                    v-model="form.apellido"
                    type="text"
                    placeholder="Pérez"
                    autocomplete="family-name"
                    @blur="onBlur('apellido')"
                  />
                  <span v-if="touched.apellido && errors.apellido" class="rmodal__error">{{ errors.apellido }}</span>
                </div>
              </div>

              <div class="rmodal__field" :class="{ 'has-error': touched.email && errors.email }">
                <label for="r-email">Correo electrónico</label>
                <input
                  id="r-email"
                  v-model="form.email"
                  type="email"
                  placeholder="juan@empresa.com"
                  autocomplete="email"
                  @blur="onBlur('email')"
                />
                <span v-if="touched.email && errors.email" class="rmodal__error">{{ errors.email }}</span>
              </div>

              <div class="rmodal__field" :class="{ 'has-error': touched.phone && errors.phone }">
                <label>Teléfono</label>
                <div class="rmodal__phone-wrap">
                  <button
                    type="button"
                    class="rmodal__country-trigger"
                    :aria-expanded="dropdownOpen"
                    aria-haspopup="listbox"
                    @click="dropdownOpen = !dropdownOpen"
                  >
                    <span class="rmodal__flag">{{ selectedCountry.flag }}</span>
                    <span class="rmodal__dial">{{ selectedCountry.dial }}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="rmodal__chevron" :class="{ open: dropdownOpen }">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  <Transition name="dropdown">
                    <div v-if="dropdownOpen" class="rmodal__country-dropdown" role="listbox">
                      <input type="text" class="rmodal__country-search" v-model="countrySearch" placeholder="Buscar país..." aria-label="Buscar país" />
                      <ul>
                        <li v-for="c in filteredCountries" :key="c.code" :class="['rmodal__country-item', { separator: c.code === '---', active: c.code === selectedCountry.code }]" role="option" :aria-selected="c.code === selectedCountry.code" @click="selectCountry(c)">
                          <template v-if="c.code !== '---'">
                            <span class="rmodal__flag">{{ c.flag }}</span>
                            <span class="rmodal__country-name">{{ c.name }}</span>
                            <span class="rmodal__country-dial">{{ c.dial }}</span>
                          </template>
                          <template v-else>
                            <span class="rmodal__sep-line" aria-hidden="true" />
                          </template>
                        </li>
                      </ul>
                    </div>
                  </Transition>

                  <input
                    class="rmodal__phone-input"
                    type="tel"
                    :value="form.phone"
                    placeholder="98 493 4039"
                    autocomplete="tel-national"
                    inputmode="tel"
                    @input="onPhoneInput"
                    @blur="onBlur('phone')"
                  />

                  <span class="rmodal__phone-status" :class="{ valid: phoneValid, invalid: touched.phone && !phoneValid && form.phone }" aria-hidden="true">
                    <svg v-if="phoneValid" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <svg v-else-if="touched.phone && !phoneValid && form.phone" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </span>
                </div>
                <span v-if="touched.phone && errors.phone" class="rmodal__error">{{ errors.phone }}</span>
              </div>

              <button class="rmodal__submit" type="submit" :disabled="submitting">
                <svg v-if="submitting" class="rmodal__spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <template v-else>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </template>
                {{ submitting ? 'Enviando...' : 'ACCEDER AL VIDEO Y DIAGNÓSTICO' }}
              </button>

              <p class="rmodal__legal">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                100% gratuito · Sin compromiso · Tus datos están seguros
              </p>
            </form>
          </template>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
@use '@/styles/colorVariables.module.scss' as colors;
@use '@/styles/fonts.modules.scss' as fonts;

$bg: #ffffff;
$border: rgba(colors.$OS-NAVY, 0.1);
$input-bg: #f9fbff;
$text-muted: #7a8ea5;
$text-body: #3a4f6a;
$accent: colors.$OS-RED;

.rmodal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
}

.rmodal {
  position: relative;
  width: 100%;
  max-width: 560px;
  background: $bg;
  border: 1px solid $border;
  border-radius: 24px;
  padding: 48px 40px 40px;
  box-shadow: 0 10px 40px rgba(colors.$OS-NAVY, 0.08), 0 40px 100px rgba(colors.$OS-NAVY, 0.12);
  max-height: 92vh;
  overflow-y: auto;

  @media (max-width: 560px) {
    padding: 44px 20px 32px;
    border-radius: 20px;
  }
}

.rmodal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid $border;
  background: rgba(255,255,255,0.03);
  color: $text-muted;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
  &:hover { border-color: rgba($accent, 0.4); color: $accent; background: rgba($accent, 0.06); }
}

.rmodal__header {
  margin-bottom: 1.5rem;
}

.rmodal__eyebrow {
  font-family: fonts.$font-accent;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 4px;
  color: $accent;
  margin: 0 0 12px;
}

.rmodal__title {
  font-family: fonts.$font-principal;
  font-size: clamp(1.7rem, 4vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.18;
  color: colors.$OS-DARK;
  margin: 0 0 8px;
}

.rmodal__title-accent { color: $accent; }

.rmodal__subtitle {
  font-family: fonts.$font-secondary;
  font-size: 0.88rem;
  color: $text-muted;
  margin: 0;
}

.rmodal__form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rmodal__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  @media (max-width: 400px) { grid-template-columns: 1fr; }
}

.rmodal__fieldset {
  border: none;
  padding: 0;
  margin: 0;

  &.has-error .rmodal__options { border-color: $accent; }
}

.rmodal__legend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: fonts.$font-interface;
  font-size: 0.88rem;
  font-weight: 700;
  color: colors.$OS-DARK;
  margin-bottom: 0.75rem;
}

.rmodal__q-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: colors.$OS-NAVY;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;
}

.rmodal__options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rmodal__option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border: 1.5px solid #E4EDF7;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
  background: #FAFBFF;

  &:hover { border-color: colors.$OS-BLUE; background: #F0F6FF; }

  &.selected {
    border-color: colors.$OS-NAVY;
    background: #EEF4FF;
  }

  &--warn.selected {
    border-color: #E6A817;
    background: #FFFBEB;
  }

  &--danger.selected {
    border-color: colors.$OS-RED;
    background: #FFF0F0;
  }

  &-radio {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #C8D8ED;
    flex-shrink: 0;
    position: relative;
    transition: border-color 0.18s;

    .rmodal__option.selected & {
      border-color: colors.$OS-NAVY;
      &::after {
        content: '';
        position: absolute;
        inset: 3px;
        border-radius: 50%;
        background: colors.$OS-NAVY;
      }
    }

    .rmodal__option--danger.selected & {
      border-color: colors.$OS-RED;
      &::after { background: colors.$OS-RED; }
    }
  }

  &-label {
    font-size: 0.88rem;
    color: #3A4F6A;
    font-weight: 500;
    line-height: 1.3;

    .rmodal__option.selected & { color: colors.$OS-DARK; font-weight: 600; }
  }
}

.rmodal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-family: fonts.$font-interface;
    font-size: 0.74rem;
    font-weight: 600;
    color: #4a5f7a;
    letter-spacing: 0.5px;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    background: $input-bg;
    border: 1px solid $border;
    border-radius: 10px;
    padding: 11px 14px;
    font-family: fonts.$font-secondary;
    font-size: 0.92rem;
    color: colors.$OS-DARK;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    &::placeholder { color: #b8cae0; }
    &:focus { border-color: rgba($accent, 0.5); background: rgba($accent, 0.04); box-shadow: 0 0 0 3px rgba($accent, 0.08); }
  }

  &.has-error input { border-color: rgba(255, 80, 100, 0.5); }
}

.rmodal__error {
  font-family: fonts.$font-interface;
  font-size: 0.72rem;
  color: #ff6680;
}

.rmodal__phone-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  background: $input-bg;
  border: 1px solid $border;
  border-radius: 10px;
  overflow: visible;
  transition: border-color 0.2s, box-shadow 0.2s;
  &:focus-within { border-color: rgba($accent, 0.5); box-shadow: 0 0 0 3px rgba($accent, 0.08); }
  .has-error & { border-color: rgba(255, 80, 100, 0.5); }
}

.rmodal__country-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 11px 10px 11px 14px;
  background: none;
  border: none;
  border-right: 1px solid $border;
  cursor: pointer;
  color: colors.$white;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s;
  border-radius: 10px 0 0 10px;
  &:hover { background: rgba(255,255,255,0.04); }
}

.rmodal__flag { font-size: 1.1rem; line-height: 1; }
.rmodal__dial { font-family: fonts.$font-accent; font-size: 0.82rem; font-weight: 600; color: #4a5f7a; }

.rmodal__chevron {
  opacity: 0.4;
  transition: transform 0.2s ease;
  &.open { transform: rotate(180deg); opacity: 0.7; }
}

.rmodal__country-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 200;
  width: 280px;
  max-height: 240px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  @media (max-width: 560px) { width: 240px; }
}

.rmodal__country-search {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  color: colors.$OS-DARK;
  font-family: fonts.$font-secondary;
  font-size: 0.84rem;
  outline: none;
  border-radius: 12px 12px 0 0;
  &::placeholder { color: #b8cae0; }
}

.rmodal__country-dropdown ul {
  list-style: none;
  padding: 4px;
  margin: 0;
  overflow-y: auto;
  max-height: 190px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
}

.rmodal__country-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover:not(.separator) { background: rgba($accent, 0.08); }
  &.active { background: rgba($accent, 0.12); }
  &.separator { padding: 4px 10px; cursor: default; }
}

.rmodal__sep-line {
  display: block;
  height: 1px;
  width: 100%;
  background: rgba(255,255,255,0.07);
}

.rmodal__country-name {
  font-family: fonts.$font-secondary;
  font-size: 0.82rem;
  color: #3a4f6a;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rmodal__country-dial {
  font-family: fonts.$font-accent;
  font-size: 0.75rem;
  color: #a0b0c5;
  flex-shrink: 0;
}

.rmodal__phone-input {
  flex: 1;
  min-width: 0;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  padding: 11px 40px 11px 12px !important;
  font-family: fonts.$font-secondary;
  font-size: 0.92rem;
  color: colors.$OS-DARK;
  outline: none !important;
  box-shadow: none !important;
  &::placeholder { color: #b8cae0; }
}

.rmodal__phone-status {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &.valid { background: rgba(16, 185, 129, 0.1); color: #10b981; }
  &.invalid { background: rgba(255, 80, 100, 0.1); color: #ff6680; }
}

.rmodal__submit {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 4px;
  padding: 15px 24px;
  font-family: fonts.$font-accent;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #ffffff;
  background: $accent;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 8px 28px rgba($accent, 0.35);
  transition: transform 0.2s ease, box-shadow 0.25s ease, opacity 0.2s;

  &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 40px rgba($accent, 0.5); }
  &:active:not(:disabled) { transform: translateY(0); }
  &:disabled { opacity: 0.7; cursor: not-allowed; }
}

@keyframes spin { to { transform: rotate(360deg); } }
.rmodal__spinner { animation: spin 0.8s linear infinite; }

.rmodal__legal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: fonts.$font-interface;
  font-size: 0.7rem;
  color: $text-muted;
  margin: 4px 0 0;
  svg { opacity: 0.5; flex-shrink: 0; }
}

// ── Disqualification ──────────────────────────────────────────────────────────
.rmodal__disq {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  padding: 1rem 0;
}

.rmodal__disq-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #FFF0F0;
  border: 1.5px solid rgba(colors.$OS-RED, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: colors.$OS-RED;
}

.rmodal__disq-title {
  font-family: fonts.$font-principal;
  font-size: 1.4rem;
  font-weight: 800;
  color: colors.$OS-DARK;
  margin: 0;
  letter-spacing: -0.02em;
}

.rmodal__disq-text {
  font-size: 0.9rem;
  color: #4A5F7A;
  line-height: 1.6;
  margin: 0;
  max-width: 440px;

  strong { color: colors.$OS-DARK; }
}

.rmodal__disq-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: 1.5px solid colors.$OS-NAVY;
  border-radius: 10px;
  padding: 0.7rem 1.5rem;
  font-family: fonts.$font-interface;
  font-size: 0.82rem;
  font-weight: 600;
  color: colors.$OS-NAVY;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  &:hover { background: colors.$OS-NAVY; color: #ffffff; }
}

.rmodal__disq-divider {
  width: 100%;
  border: none;
  border-top: 1px solid #E4EDF7;
  margin: 0.5rem 0;
}

.rmodal__disq-legal {
  font-size: 0.76rem;
  color: #A0B0C5;
  margin: 0;
  a { color: colors.$OS-NAVY; font-weight: 600; }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.rmodal-fade-enter-active {
  transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
  .rmodal { transition: opacity 0.3s ease, transform 0.38s cubic-bezier(0.34, 1.4, 0.64, 1); }
}
.rmodal-fade-leave-active {
  transition: opacity 0.22s ease;
  .rmodal { transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.55, 0, 1, 0.45); }
}
.rmodal-fade-enter-from {
  opacity: 0;
  .rmodal { opacity: 0; transform: scale(0.92) translateY(24px); }
}
.rmodal-fade-leave-to {
  opacity: 0;
  .rmodal { opacity: 0; transform: scale(0.95) translateY(10px); }
}

.dropdown-enter-active { transition: opacity 0.18s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.dropdown-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-enter-from { opacity: 0; transform: translateY(-8px) scale(0.97); }
.dropdown-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
</style>
