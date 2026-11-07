import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LocateFixed,
  Mail,
  MapPin,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react'
import { Alert } from '../components/ui/Alert'
import { Button, ButtonLink } from '../components/ui/Button'
import { CheckboxField, SelectField, TextareaField, TextInput } from '../components/ui/Field'
import { FileUploader } from '../components/ui/FileUploader'
import { DocumentStep } from '../components/register/DocumentStep'
import { MultiFileUploader } from '../components/register/MultiFileUploader'
import { RegistrationShell } from '../components/register/RegistrationShell'
import { ReviewSection } from '../components/register/ReviewSection'
import { useCopy } from '../i18n'
import { ApiError, submitApplication, type ApplicationRequirement } from '../lib/api'
import { useAuth } from '../lib/auth'
import { isPartnerApiConfigured } from '../lib/config'
import {
  categoryCodes,
  clearDraft,
  emailPattern,
  loadDraft,
  mapOptions,
  regionCodes,
  saveDraft,
  vendorTypeCodes,
} from '../lib/forms'
import { formatDateTime, isValidTZPhone } from '../lib/utils'

const DRAFT_KEY = 'agiza.web.draft.vendor'

interface VendorValues {
  fullName: string
  email: string
  businessName: string
  vendorType: string
  businessDescription: string
  businessPhone: string
  alternativePhone: string
  category: string
  region: string
  district: string
  ward: string
  street: string
  openingHours: string
  consentTerms: boolean
  consentAccuracy: boolean
  consentReview: boolean
}

const emptyVendor: VendorValues = {
  fullName: '',
  email: '',
  businessName: '',
  vendorType: '',
  businessDescription: '',
  businessPhone: '',
  alternativePhone: '',
  category: '',
  region: '',
  district: '',
  ward: '',
  street: '',
  openingHours: '',
  consentTerms: false,
  consentAccuracy: false,
  consentReview: false,
}

const stepFields: (keyof VendorValues)[][] = [
  ['fullName', 'email', 'consentTerms', 'consentAccuracy', 'consentReview'],
  [
    'businessName',
    'vendorType',
    'businessDescription',
    'businessPhone',
    'alternativePhone',
    'category',
    'region',
    'district',
    'ward',
    'street',
  ],
  [],
  ['openingHours'],
  [],
]

function StepHeader({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-charcoal text-xs font-bold text-white">
          {String(number).padStart(2, '0')}
        </span>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-brand-charcoal">{title}</h2>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">{body}</p>
    </div>
  )
}

export function VendorRegister() {
  const c = useCopy()
  const { user } = useAuth()
  const [initial] = useState(() =>
    loadDraft<VendorValues>(DRAFT_KEY, {
      ...emptyVendor,
      email: user?.email || '',
      businessPhone: user?.phone || '',
    }),
  )
  const [current, setCurrent] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [selectedDocs, setSelectedDocs] = useState<Record<string, File | null>>({})
  const [docRequirements, setDocRequirements] = useState<ApplicationRequirement[]>([])
  const [docError, setDocError] = useState('')
  const [profileImage, setProfileImage] = useState<File | null>(null)
  const [logo, setLogo] = useState<File | null>(null)
  const [premisesPhotos, setPremisesPhotos] = useState<File[]>([])
  const [foodPhotos, setFoodPhotos] = useState<File[]>([])
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [apiBlocked, setApiBlocked] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  const schema = useMemo(
    () =>
      z.object({
        fullName: z.string().trim().min(3, c.validation.name),
        email: z
          .string()
          .trim()
          .refine((value) => !value || emailPattern.test(value), c.validation.email),
        businessName: z.string().trim().min(2, c.validation.required),
        vendorType: z.string().min(1, c.validation.select),
        businessDescription: z.string().trim().min(10, c.validation.description),
        businessPhone: z.string().min(1, c.validation.required).refine(isValidTZPhone, c.validation.phone),
        alternativePhone: z
          .string()
          .trim()
          .refine((value) => !value || isValidTZPhone(value), c.validation.phone),
        category: z.string().min(1, c.validation.select),
        region: z.string().min(1, c.validation.select),
        district: z.string().trim().min(1, c.validation.required),
        ward: z.string().trim().min(1, c.validation.required),
        street: z.string().trim().min(2, c.validation.address),
        openingHours: z.string().trim().min(2, c.validation.required),
        consentTerms: z.boolean().refine(Boolean, c.validation.consent),
        consentAccuracy: z.boolean().refine(Boolean, c.validation.consent),
        consentReview: z.boolean().refine(Boolean, c.validation.consent),
      }),
    [c],
  )

  const methods = useForm<VendorValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: initial,
  })
  const { formState, register, trigger, getValues, watch, handleSubmit } = methods
  const values = watch()
  const errors = formState.errors

  useEffect(() => {
    const subscription = watch((next) => {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        saveDraft(DRAFT_KEY, next)
        setSavedAt(Date.now())
      }, 700)
    })
    return () => {
      subscription.unsubscribe()
      window.clearTimeout(saveTimer.current)
    }
  }, [watch])

  const handleRequirements = useCallback((requirements: ApplicationRequirement[]) => {
    setDocRequirements(requirements)
  }, [])

  const options = {
    vendorTypes: mapOptions(vendorTypeCodes, c.register.options.vendorTypes),
    categories: mapOptions(categoryCodes, c.register.options.categories),
    regions: mapOptions(regionCodes, c.register.options.regions),
  }

  const captureLocation = () => {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError(c.register.flow.locationFailed)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocationError(c.register.flow.locationFailed)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const persist = () => {
    saveDraft(DRAFT_KEY, getValues())
    setSavedAt(Date.now())
  }

  const goTo = (step: number) => {
    persist()
    setDocError('')
    setCurrent(step)
    setMaxReached((value) => Math.max(value, step))
  }

  const next = async () => {
    setDocError('')
    const fields = stepFields[current]
    if (fields.length) {
      const valid = await trigger(fields)
      if (!valid) return
    }
    if (current === 2) {
      const missing = docRequirements.filter(
        (requirement) => requirement.mandatory && !selectedDocs[requirement.code],
      )
      if (missing.length) {
        setDocError(`${c.register.flow.missingRequired} ${missing.map((item) => item.label).join(', ')}`)
        return
      }
    }
    goTo(Math.min(4, current + 1))
  }

  const back = () => {
    persist()
    setDocError('')
    setCurrent((value) => Math.max(0, value - 1))
  }

  const onSubmit = handleSubmit(async (formValues) => {
    setSubmitError('')
    setApiBlocked(false)
    if (!isPartnerApiConfigured) {
      setApiBlocked(true)
      return
    }

    const missing = docRequirements.filter(
      (requirement) => requirement.mandatory && !selectedDocs[requirement.code],
    )
    if (missing.length) {
      setDocError(`${c.register.flow.missingRequired} ${missing.map((item) => item.label).join(', ')}`)
      setCurrent(2)
      return
    }

    const formData = new FormData()
    formData.append(
      'payload',
      JSON.stringify({
        ...formValues,
        phone: user?.phone || '',
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        documents: docRequirements.map((requirement) => ({
          code: requirement.code,
          label: requirement.label,
          mandatory: requirement.mandatory,
        })),
      }),
    )
    Object.entries(selectedDocs).forEach(([code, file]) => {
      if (file) formData.append(`document_${code}`, file, file.name)
    })
    if (profileImage) formData.append('profile_image', profileImage, profileImage.name)
    if (logo) formData.append('logo', logo, logo.name)
    premisesPhotos.forEach((file, index) => formData.append(`premises_photo_${index + 1}`, file, file.name))
    foodPhotos.forEach((file, index) => formData.append(`food_photo_${index + 1}`, file, file.name))

    setUploadProgress(0)
    try {
      const response = await submitApplication('vendor', formData, setUploadProgress)
      clearDraft(DRAFT_KEY)
      setSubmitted(response)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : c.register.errorBody)
    }
  })

  if (submitted) {
    const reference = typeof submitted.reference === 'string' ? submitted.reference : ''
    const submittedAt = typeof submitted.submitted_at === 'string' ? submitted.submitted_at : ''
    return (
      <section className="container-page py-14 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="surface-card p-7 text-center sm:p-10">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand-success/10 text-brand-success">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <h1 className="mt-5 font-display text-[2rem] font-extrabold tracking-tight text-brand-charcoal">
              {c.register.submittedTitle}
            </h1>
            <p className="mt-3 text-sm leading-7 text-brand-muted">{c.register.submittedBody}</p>
            <dl className="mt-6 grid gap-3 rounded-2xl border border-brand-line bg-brand-cream/60 p-4 text-left sm:grid-cols-2">
              <div>
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                  {c.register.reference}
                </dt>
                <dd className="mt-1 break-all text-sm font-bold text-brand-charcoal">
                  {reference || c.register.flow.referencePending}
                </dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                  {c.register.submittedAt}
                </dt>
                <dd className="mt-1 text-sm font-bold text-brand-charcoal">
                  {submittedAt ? formatDateTime(submittedAt) : c.common.notProvided}
                </dd>
              </div>
            </dl>
            <ol className="mt-6 space-y-2 text-left">
              {c.register.nextSteps.map((step) => (
                <li key={step} className="flex items-start gap-2 text-xs leading-5 text-brand-muted">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-success" aria-hidden="true" />
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-7 flex flex-col gap-2">
              <ButtonLink to="/application-status" size="lg" fullWidth>
                {c.register.viewStatus}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/" size="lg" variant="secondary" fullWidth>
                {c.common.backHome}
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const docFiles = Object.entries(selectedDocs)
    .filter((entry): entry is [string, File] => Boolean(entry[1]))
    .map(([code, file]) => ({
      label: docRequirements.find((requirement) => requirement.code === code)?.label || code,
      file,
    }))

  const reviewFiles = [
    ...(profileImage ? [{ label: c.register.fields.profileImage, file: profileImage }] : []),
    ...(logo ? [{ label: c.register.fields.logo, file: logo }] : []),
    ...premisesPhotos.map((file, index) => ({
      label: `${c.register.fields.businessPhoto} ${index + 1}`,
      file,
    })),
    ...foodPhotos.map((file, index) => ({ label: `${c.register.fields.foodPhoto} ${index + 1}`, file })),
  ]

  const selectedVendorType =
    options.vendorTypes.find((option) => option.value === values.vendorType)?.label || c.common.notProvided
  const selectedCategory =
    options.categories.find((option) => option.value === values.category)?.label || c.common.notProvided
  const selectedRegion =
    options.regions.find((option) => option.value === values.region)?.label || c.common.notProvided

  return (
    <RegistrationShell type="vendor" current={current} maxReached={maxReached} onStepClick={(step) => goTo(step)}>
      <form onSubmit={current === 4 ? onSubmit : (event) => event.preventDefault()} noValidate>
        {!isPartnerApiConfigured ? (
          <Alert tone="warning" title={c.register.backendMissingTitle} className="mb-6">
            <p>{c.register.backendMissingBody}</p>
            <p className="mt-2 text-xs">{c.register.backendMissingHint}</p>
          </Alert>
        ) : null}

        {savedAt ? (
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-brand-success" aria-live="polite">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {c.register.flow.draftReady}
          </p>
        ) : null}

        <div className="rounded-[2rem] border border-brand-line bg-white p-5 sm:p-7 lg:p-9">
          {current === 0 ? (
            <div>
              <StepHeader number={1} title={c.register.vendor.step1Title} body={c.register.vendor.step1Body} />
              <Alert tone="secure" title={c.register.flow.signedIn} className="mb-6">
                {c.register.flow.accountNote}
              </Alert>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput
                  label={c.register.fields.fullName}
                  hint={c.register.fields.fullNameHint}
                  autoComplete="name"
                  error={errors.fullName?.message}
                  {...register('fullName')}
                />
                <TextInput
                  label={c.register.fields.emailOptional}
                  hint={c.register.fields.emailHint}
                  type="email"
                  autoComplete="email"
                  leading={<Mail className="h-4 w-4" aria-hidden="true" />}
                  optional
                  optionalLabel={c.common.optional}
                  error={errors.email?.message}
                  {...register('email')}
                />
                <TextInput
                  label={c.register.fields.phone}
                  value={user?.phone || ''}
                  readOnly
                  leading={<UserRound className="h-4 w-4" aria-hidden="true" />}
                  hint={c.register.flow.verifiedPhone}
                />
                <div className="rounded-2xl border border-brand-line bg-brand-cream/60 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-muted">
                    {c.register.flow.accountName}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-brand-charcoal">
                    {user?.username || c.common.notProvided}
                  </p>
                  <p className="mt-1 truncate text-xs text-brand-muted">
                    {user?.email || c.register.flow.accountEmail + ': ' + c.common.notProvided}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <CheckboxField
                  label={
                    <>
                      {c.register.fields.consentTerms}{' '}
                      <Link to="/terms" className="font-bold text-brand-dark underline underline-offset-4">
                        {c.legal.termsTitle}
                      </Link>{' '}
                      ·{' '}
                      <Link to="/privacy" className="font-bold text-brand-dark underline underline-offset-4">
                        {c.legal.privacyTitle}
                      </Link>
                    </>
                  }
                  error={errors.consentTerms?.message}
                  {...register('consentTerms')}
                />
                <CheckboxField
                  label={c.register.fields.consentAccuracy}
                  error={errors.consentAccuracy?.message}
                  {...register('consentAccuracy')}
                />
                <CheckboxField
                  label={c.register.fields.consentReview}
                  error={errors.consentReview?.message}
                  {...register('consentReview')}
                />
              </div>
            </div>
          ) : null}

          {current === 1 ? (
            <div>
              <StepHeader number={2} title={c.register.vendor.step2Title} body={c.register.vendor.step2Body} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput
                  label={c.register.fields.businessName}
                  autoComplete="organization"
                  error={errors.businessName?.message}
                  {...register('businessName')}
                />
                <SelectField
                  label={c.register.fields.vendorType}
                  options={options.vendorTypes}
                  error={errors.vendorType?.message}
                  placeholder={c.validation.select}
                  {...register('vendorType')}
                />
              </div>
              <div className="mt-5">
                <TextareaField
                  label={c.register.fields.businessDescription}
                  hint={c.register.fields.businessDescriptionHint}
                  error={errors.businessDescription?.message}
                  {...register('businessDescription')}
                />
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <TextInput
                  label={c.register.fields.businessPhone}
                  hint={c.validation.phone}
                  inputMode="tel"
                  autoComplete="tel"
                  error={errors.businessPhone?.message}
                  {...register('businessPhone')}
                />
                <TextInput
                  label={c.register.fields.alternativePhone}
                  hint={c.validation.phone}
                  inputMode="tel"
                  optional
                  optionalLabel={c.common.optional}
                  error={errors.alternativePhone?.message}
                  {...register('alternativePhone')}
                />
                <SelectField
                  label={c.register.fields.category}
                  hint={c.register.fields.categoryHint}
                  options={options.categories}
                  error={errors.category?.message}
                  placeholder={c.validation.select}
                  {...register('category')}
                />
                <SelectField
                  label={c.register.fields.region}
                  options={options.regions}
                  error={errors.region?.message}
                  placeholder={c.validation.select}
                  {...register('region')}
                />
                <TextInput
                  label={c.register.fields.district}
                  error={errors.district?.message}
                  {...register('district')}
                />
                <TextInput label={c.register.fields.ward} error={errors.ward?.message} {...register('ward')} />
              </div>
              <div className="mt-5">
                <TextInput
                  label={c.register.fields.street}
                  hint={c.register.fields.locationHint}
                  leading={<MapPin className="h-4 w-4" aria-hidden="true" />}
                  error={errors.street?.message}
                  {...register('street')}
                />
              </div>
              <div className="mt-4 rounded-2xl border border-brand-line bg-brand-cream/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-charcoal">{c.register.fields.location}</p>
                    <p className="mt-1 text-xs leading-5 text-brand-muted">
                      {coords
                        ? `${c.register.flow.locationCaptured}: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                        : c.register.flow.locationOptional}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={captureLocation}
                    loading={locating}
                    disabled={locating}
                  >
                    <LocateFixed className="h-4 w-4" aria-hidden="true" />
                    {c.register.flow.useLocation}
                  </Button>
                </div>
                {locationError ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-brand-warning" role="alert">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {locationError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {current === 2 ? (
            <div>
              <StepHeader number={3} title={c.register.vendor.step3Title} body={c.register.vendor.step3Body} />
              <DocumentStep
                type="vendor"
                stage="business"
                files={selectedDocs}
                onFileChange={(code, file) => setSelectedDocs((currentFiles) => ({ ...currentFiles, [code]: file }))}
                onRequirementsChange={handleRequirements}
              />
              {docError ? (
                <Alert tone="error" title={c.register.flow.missingRequired} className="mt-4">
                  {docError}
                </Alert>
              ) : null}
            </div>
          ) : null}

          {current === 3 ? (
            <div>
              <StepHeader number={4} title={c.register.vendor.step4Title} body={c.register.vendor.step4Body} />
              <div className="space-y-4">
                <FileUploader
                  label={c.register.fields.profileImage}
                  required={false}
                  optionalLabel={c.common.optional}
                  requiredLabel={c.common.required}
                  accept=".jpg,.jpeg,.png"
                  imageOnly
                  value={profileImage}
                  onChange={setProfileImage}
                  messages={{
                    upload: c.register.docs.upload,
                    replace: c.register.docs.replace,
                    remove: c.register.docs.remove,
                    selected: c.register.docs.selected,
                    uploaded: c.register.docs.uploaded,
                    types: c.register.docs.imageTypes,
                    maxSize: c.register.docs.maxSize,
                    fileType: c.validation.fileTypeImage,
                    fileSize: c.validation.fileSize,
                  }}
                />
                <FileUploader
                  label={c.register.fields.logo}
                  required={false}
                  optionalLabel={c.common.optional}
                  requiredLabel={c.common.required}
                  accept=".jpg,.jpeg,.png"
                  imageOnly
                  value={logo}
                  onChange={setLogo}
                  messages={{
                    upload: c.register.docs.upload,
                    replace: c.register.docs.replace,
                    remove: c.register.docs.remove,
                    selected: c.register.docs.selected,
                    uploaded: c.register.docs.uploaded,
                    types: c.register.docs.imageTypes,
                    maxSize: c.register.docs.maxSize,
                    fileType: c.validation.fileTypeImage,
                    fileSize: c.validation.fileSize,
                  }}
                />
                <MultiFileUploader
                  label={c.register.fields.businessPhoto}
                  hint={c.register.flow.photosHint}
                  files={premisesPhotos}
                  onChange={setPremisesPhotos}
                  maxFiles={3}
                  imageOnly
                  messages={{
                    add: c.register.flow.addPhoto,
                    remove: c.register.flow.remove,
                    count: c.register.flow.photoCount,
                    max: c.register.flow.maxPhotos,
                    fileType: c.validation.fileType,
                    fileSize: c.validation.fileSize,
                  }}
                />
                <MultiFileUploader
                  label={c.register.fields.foodPhoto}
                  hint={c.register.flow.photosHint}
                  files={foodPhotos}
                  onChange={setFoodPhotos}
                  maxFiles={3}
                  imageOnly
                  messages={{
                    add: c.register.flow.addPhoto,
                    remove: c.register.flow.remove,
                    count: c.register.flow.photoCount,
                    max: c.register.flow.maxPhotos,
                    fileType: c.validation.fileType,
                    fileSize: c.validation.fileSize,
                  }}
                />
                <TextInput
                  label={c.register.fields.openingHours}
                  hint={c.register.fields.openingHoursHint}
                  error={errors.openingHours?.message}
                  {...register('openingHours')}
                />
              </div>
            </div>
          ) : null}

          {current === 4 ? (
            <div>
              <StepHeader number={5} title={c.register.vendor.step5Title} body={c.register.vendor.step5Body} />
              <Alert tone="info" className="mb-5">
                {c.register.flow.reviewNote}
              </Alert>
              <div className="space-y-4">
                <ReviewSection
                  title={c.register.review.account}
                  editLabel={c.register.review.edit}
                  onEdit={() => goTo(0)}
                  rows={[
                    { label: c.register.fields.fullName, value: values.fullName },
                    { label: c.register.fields.email, value: values.email || c.common.notProvided },
                    { label: c.register.fields.phone, value: user?.phone || c.common.notProvided },
                  ]}
                />
                <ReviewSection
                  title={c.register.review.business}
                  editLabel={c.register.review.edit}
                  onEdit={() => goTo(1)}
                  rows={[
                    { label: c.register.fields.businessName, value: values.businessName },
                    { label: c.register.fields.vendorType, value: selectedVendorType },
                    { label: c.register.fields.category, value: selectedCategory },
                    { label: c.register.fields.businessPhone, value: values.businessPhone },
                    {
                      label: c.register.fields.businessDescription,
                      value: values.businessDescription,
                    },
                    { label: c.register.fields.region, value: selectedRegion },
                    { label: c.register.fields.district, value: values.district },
                    { label: c.register.fields.ward, value: values.ward },
                    { label: c.register.fields.street, value: values.street },
                    {
                      label: c.register.fields.location,
                      value: coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : c.common.notProvided,
                    },
                  ]}
                />
                <ReviewSection
                  title={c.register.review.documents}
                  editLabel={c.register.review.edit}
                  onEdit={() => goTo(2)}
                  rows={[]}
                  files={docFiles}
                  filesLabel={c.register.flow.selectedFiles}
                  noFilesLabel={c.register.flow.noDocuments}
                />
                <ReviewSection
                  title={c.register.review.profile}
                  editLabel={c.register.review.edit}
                  onEdit={() => goTo(3)}
                  rows={[
                    { label: c.register.fields.openingHours, value: values.openingHours },
                    {
                      label: c.register.flow.photosTitle,
                      value: `${premisesPhotos.length + foodPhotos.length} ${c.register.flow.photoCount}`,
                    },
                  ]}
                  files={reviewFiles}
                  filesLabel={c.register.flow.selectedFiles}
                  noFilesLabel={c.register.flow.noDocuments}
                />
              </div>

              {apiBlocked || !isPartnerApiConfigured ? (
                <Alert tone="warning" title={c.register.backendMissingTitle} className="mt-5">
                  {c.register.flow.apiDisabled}
                </Alert>
              ) : null}

              {submitError ? (
                <Alert tone="error" title={c.register.errorTitle} className="mt-5">
                  {submitError}
                </Alert>
              ) : null}

              <div className="mt-5 flex items-start gap-2 rounded-2xl border border-brand-line bg-brand-cream/60 p-4 text-xs leading-5 text-brand-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
                <span>
                  {c.register.flow.submitNote} {c.register.flow.submittingHint}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {docError && current !== 2 ? (
          <Alert tone="error" title={c.register.flow.missingRequired} className="mt-4">
            {docError}
          </Alert>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {current > 0 ? (
              <Button type="button" variant="secondary" size="lg" onClick={back}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {c.common.back}
              </Button>
            ) : (
              <ButtonLink to="/vendors" variant="secondary" size="lg">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {c.vendors.eyebrow}
              </ButtonLink>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {current < 4 ? (
              <Button type="button" size="lg" onClick={next}>
                {c.common.continue}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                loading={formState.isSubmitting}
                disabled={!isPartnerApiConfigured}
              >
                {formState.isSubmitting
                  ? uploadProgress > 0
                    ? `${c.common.submitting} ${uploadProgress}%`
                    : c.common.submitting
                  : c.common.submitApplication}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <p className="max-w-xs text-right text-[0.68rem] leading-4 text-brand-muted">
              {current < 4 ? c.register.draftNote : c.register.submittedBody}
            </p>
          </div>
        </div>

        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-brand-muted">
          <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" aria-hidden="true" />
          {c.register.vendor.lead}
        </p>
      </form>
    </RegistrationShell>
  )
}
