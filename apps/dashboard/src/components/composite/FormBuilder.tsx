/**
 * FormBuilder — renders dynamic forms from JSON schema for connector/agent config.
 *
 * M1.5: UI Component Library — composite components.
 */
import { useState, type FormEvent } from 'react'

export interface FieldSchema {
  name: string
  label: string
  type: 'text' | 'number' | 'password' | 'select' | 'checkbox' | 'textarea'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
  defaultValue?: string | number | boolean
  helpText?: string
}

interface FormBuilderProps {
  schema: FieldSchema[]
  onSubmit: (values: Record<string, unknown>) => void
  submitLabel?: string
  className?: string
  initialValues?: Record<string, unknown>
}

export function FormBuilder({ schema, onSubmit, submitLabel = 'Save', className = '', initialValues = {} }: FormBuilderProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const field of schema) {
      init[field.name] = initialValues[field.name] ?? field.defaultValue ?? ''
    }
    return init
  })

  function handleChange(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {schema.map((field) => (
        <div key={field.name} className="space-y-1">
          <label htmlFor={field.name} className="text-sm font-medium">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {field.type === 'select' ? (
            <select
              id={field.name}
              value={String(values[field.name] ?? '')}
              onChange={(e) => handleChange(field.name, e.target.value)}
              required={field.required}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : field.type === 'checkbox' ? (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={field.name}
                checked={Boolean(values[field.name])}
                onChange={(e) => handleChange(field.name, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-muted-foreground">{field.helpText}</span>
            </div>
          ) : field.type === 'textarea' ? (
            <textarea
              id={field.name}
              value={String(values[field.name] ?? '')}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          ) : (
            <input
              id={field.name}
              type={field.type}
              value={String(values[field.name] ?? '')}
              onChange={(e) => handleChange(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            />
          )}

          {field.helpText && field.type !== 'checkbox' && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      ))}

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {submitLabel}
      </button>
    </form>
  )
}
