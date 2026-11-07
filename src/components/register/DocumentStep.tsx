import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileCheck2, Loader2, ShieldCheck } from 'lucide-react'
import { fetchApplicationRequirements, type ApplicationRequirement } from '../../lib/api'
import { isPartnerApiConfigured } from '../../lib/config'
import { useCopy, useI18n } from '../../i18n'
import { Alert } from '../ui/Alert'
import { FileUploader } from '../ui/FileUploader'

type Stage = 'business' | 'identity' | 'vehicle'

interface PreviewRequirement {
  code: string
  mandatory: boolean
  category: Stage
  appliesTo?: string[]
  labelKey: string
  whyKey: string
}

const previewRequirements: { vendor: PreviewRequirement[]; rider: PreviewRequirement[] } = {
  vendor: [
    {
      code: 'business_registration',
      mandatory: false,
      category: 'business',
      labelKey: 'businessRegistration',
      whyKey: 'businessRegistrationWhy',
    },
    {
      code: 'business_permit',
      mandatory: false,
      category: 'business',
      labelKey: 'businessPermit',
      whyKey: 'businessPermitWhy',
    },
    {
      code: 'owner_identity',
      mandatory: true,
      category: 'business',
      labelKey: 'ownerIdentity',
      whyKey: 'ownerIdentityWhy',
    },
    {
      code: 'supporting',
      mandatory: false,
      category: 'business',
      labelKey: 'supporting',
      whyKey: 'supportingWhy',
    },
  ],
  rider: [
    {
      code: 'national_id',
      mandatory: true,
      category: 'identity',
      labelKey: 'nationalId',
      whyKey: 'nationalIdWhy',
    },
    {
      code: 'other_identity',
      mandatory: false,
      category: 'identity',
      labelKey: 'otherIdentity',
      whyKey: 'otherIdentityWhy',
    },
    {
      code: 'driving_licence',
      mandatory: false,
      category: 'vehicle',
      appliesTo: ['motorcycle', 'car', 'other'],
      labelKey: 'drivingLicence',
      whyKey: 'drivingLicenceWhy',
    },
    {
      code: 'vehicle_registration',
      mandatory: true,
      category: 'vehicle',
      appliesTo: ['motorcycle', 'car', 'other'],
      labelKey: 'vehicleRegistration',
      whyKey: 'vehicleRegistrationWhy',
    },
    {
      code: 'vehicle_insurance',
      mandatory: false,
      category: 'vehicle',
      appliesTo: ['motorcycle', 'car', 'other'],
      labelKey: 'vehicleInsurance',
      whyKey: 'vehicleInsuranceWhy',
    },
    {
      code: 'vehicle_inspection',
      mandatory: false,
      category: 'vehicle',
      appliesTo: ['motorcycle', 'car', 'other'],
      labelKey: 'vehicleInspection',
      whyKey: 'vehicleInspectionWhy',
    },
    {
      code: 'rider_photo',
      mandatory: true,
      category: 'vehicle',
      labelKey: 'riderPhoto',
      whyKey: 'riderPhotoWhy',
    },
  ],
}

function copyValue(c: ReturnType<typeof useCopy>, key: string) {
  const docs = c.register.docs as Record<string, string>
  return docs[key] || key
}

function inferCategory(type: 'vendor' | 'rider', requirement: ApplicationRequirement): Stage {
  if (requirement.category === 'business' || requirement.category === 'identity' || requirement.category === 'vehicle') {
    return requirement.category
  }
  if (type === 'vendor') return 'business'
  const code = requirement.code.toLowerCase()
  if (code.includes('vehicle') || code.includes('licence') || code.includes('insurance') || code.includes('inspection') || code.includes('photo')) {
    return 'vehicle'
  }
  return 'identity'
}

export function DocumentStep({
  type,
  stage,
  vehicleType,
  files,
  onFileChange,
  onRequirementsChange,
  disabled,
}: {
  type: 'vendor' | 'rider'
  stage: Stage
  vehicleType?: string
  files: Record<string, File | null>
  onFileChange: (code: string, file: File | null) => void
  onRequirementsChange?: (requirements: ApplicationRequirement[]) => void
  disabled?: boolean
}) {
  const c = useCopy()
  const { lang } = useI18n()
  const [requirements, setRequirements] = useState<ApplicationRequirement[]>([])
  const [loading, setLoading] = useState(isPartnerApiConfigured)
  const [usingPreview, setUsingPreview] = useState(!isPartnerApiConfigured)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    if (!isPartnerApiConfigured) {
      setUsingPreview(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    fetchApplicationRequirements(type)
      .then((response) => {
        if (!active) return
        const list = Array.isArray(response) ? response : response.results
        setRequirements(list)
        setUsingPreview(false)
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Could not load requirements.')
        setUsingPreview(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [type])

  const preview = useMemo(
    () =>
      previewRequirements[type].map<ApplicationRequirement>((item) => ({
        id: item.code,
        code: item.code,
        application_type: type,
        label: copyValue(c, item.labelKey),
        label_sw: copyValue(c, item.labelKey),
        description: copyValue(c, item.whyKey),
        description_sw: copyValue(c, item.whyKey),
        mandatory: item.mandatory,
        allowed_types: ['application/pdf', 'image/jpeg', 'image/png'],
        max_size_mb: 10,
        applies_to: item.appliesTo || [],
        category: item.category,
        sort_order: 0,
      })),
    [c, type],
  )

  const source = usingPreview ? preview : requirements
  const visible = useMemo(
    () =>
      source
        .filter((requirement) => inferCategory(type, requirement) === stage)
        .filter((requirement) => {
          if (!requirement.applies_to?.length) return true
          if (!vehicleType) return true
          return requirement.applies_to.includes(vehicleType)
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [source, stage, type, vehicleType],
  )

  useEffect(() => {
    onRequirementsChange?.(visible)
  }, [onRequirementsChange, visible])

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand-line bg-white p-5 text-sm text-brand-muted">
        <Loader2 className="h-4 w-4 animate-spin text-brand-orange" aria-hidden="true" />
        {c.common.loading}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {usingPreview ? (
        <Alert tone="info" title={c.register.docs.noRequirementsTitle}>
          {c.register.docs.noRequirementsBody}
        </Alert>
      ) : null}

      {loadError ? (
        <Alert tone="warning" title={c.register.backendMissingTitle}>
          {loadError}
        </Alert>
      ) : null}

      {usingPreview ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-brand-warning/25 bg-brand-warning/5 p-4 text-xs leading-5 text-brand-muted">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-warning" aria-hidden="true" />
          <p>
            <span className="font-bold text-brand-charcoal">{c.register.docs.previewTitle}. </span>
            {c.register.docs.previewBody}
          </p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-xs font-semibold text-brand-success">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {c.register.docs.loaded}
        </p>
      )}

      {visible.length === 0 ? (
        usingPreview ? null : (
          <Alert tone="info" title={c.register.docs.emptyTitle}>
            {c.register.docs.emptyBody}
          </Alert>
        )
      ) : (
        visible.map((requirement) => {
          const docLabel = lang === 'sw' && requirement.label_sw ? requirement.label_sw : requirement.label
          const docDescription =
            lang === 'sw' && requirement.description_sw ? requirement.description_sw : requirement.description
          return (
            <FileUploader
              key={requirement.code}
              label={docLabel}
              why={docDescription}
              whyLabel={c.register.docs.why}
              required={requirement.mandatory}
              optionalLabel={c.common.optional}
              requiredLabel={c.register.docs.mandatory}
              maxSizeMb={requirement.max_size_mb || 10}
              value={files[requirement.code] || null}
              onChange={(file) => onFileChange(requirement.code, file)}
              messages={{
                upload: c.register.docs.upload,
                replace: c.register.docs.replace,
                remove: c.register.docs.remove,
                selected: c.register.docs.selected,
                uploaded: c.register.docs.uploaded,
                types: c.register.docs.types,
                maxSize: c.register.docs.maxSize,
                fileType: c.validation.fileType,
                fileSize: c.validation.fileSize,
              }}
              disabled={disabled}
            />
          )
        })
      )}

      <p className="flex items-start gap-2 rounded-2xl border border-brand-line bg-brand-cream/60 p-4 text-xs leading-5 text-brand-muted">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
        {c.register.devStorageNote}
      </p>
    </div>
  )
}

export function requiredDocuments(
  type: 'vendor' | 'rider',
  stage: Stage,
  c: ReturnType<typeof useCopy>,
  vehicleType?: string,
) {
  return previewRequirements[type]
    .filter((item) => item.category === stage && item.mandatory)
    .filter((item) => !item.appliesTo?.length || !vehicleType || item.appliesTo.includes(vehicleType))
    .map((item) => ({ code: item.code, label: copyValue(c, item.labelKey) }))
}
