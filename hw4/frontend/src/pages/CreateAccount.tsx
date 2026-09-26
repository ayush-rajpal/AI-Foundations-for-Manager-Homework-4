import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { isValidPhoneNumber, type CountryCode } from 'libphonenumber-js'
import { useAuth } from '../auth'
import PasswordInput from '../components/PasswordInput'
import { COUNTRIES, DEFAULT_COUNTRY } from '../countries'

const MIN_PASSWORD = 8

// Same rules the backend enforces (backend/auth.py password_problems).
const PASSWORD_RULES = [
  { label: `At least ${MIN_PASSWORD} characters`, test: (p: string) => p.length >= MIN_PASSWORD },
  { label: 'A capital letter', test: (p: string) => /\p{Lu}/u.test(p) },
  { label: 'A special character (like ! @ # $ %)', test: (p: string) => /[^\p{L}\p{N}\s]/u.test(p) },
]

export default function CreateAccount() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountry: DEFAULT_COUNTRY as CountryCode,
    phone: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user && !submitting) return <Navigate to="/" replace />

  const update = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value })

  const confirmMismatch = form.confirm.length > 0 && form.password !== form.confirm

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!PASSWORD_RULES.every((r) => r.test(form.password)))
      return setError('Please choose a password that meets all the requirements below it.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    const phone = form.phone.trim()
    if (phone && !isValidPhoneNumber(phone, form.phoneCountry))
      return setError("That phone number doesn't look valid for the selected country.")

    setError('')
    setSubmitting(true)
    try {
      await register({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
        phone: phone || null,
        phone_country: phone ? form.phoneCountry : null,
      })
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>Create your account</h1>
        <p className="auth-sub">Save your chats with our assistant and get help finding your fit.</p>
        <p className="required-note">
          <Required /> Required field
        </p>

        <div className="form-row">
          <label>
            <span>
              First name <Required />
            </span>
            <input value={form.firstName} onChange={update('firstName')} required maxLength={50} autoComplete="given-name" />
          </label>
          <label>
            <span>
              Last name <Required />
            </span>
            <input value={form.lastName} onChange={update('lastName')} required maxLength={50} autoComplete="family-name" />
          </label>
        </div>

        <label>
          <span>
            Email <Required />
          </span>
          <input type="email" value={form.email} onChange={update('email')} required autoComplete="email" />
        </label>

        <div className="field">
          <span className="field-label">
            Phone number
          </span>
          <div className="phone-field">
            <select
              value={form.phoneCountry}
              onChange={update('phoneCountry')}
              aria-label="Country code"
              autoComplete="tel-country-code"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} (+{c.dialCode})
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={form.phone}
              onChange={update('phone')}
              placeholder="(203) 555-0147"
              aria-label="Phone number"
              autoComplete="tel-national"
            />
          </div>
        </div>

        <label>
          <span>
            Password <Required />
          </span>
          <PasswordInput
            value={form.password}
            onChange={update('password')}
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
          />
          <ul className="password-rules" aria-label="Password requirements">
            {PASSWORD_RULES.map((r) => {
              const met = r.test(form.password)
              return (
                <li key={r.label} className={met ? 'met' : ''}>
                  <span aria-hidden="true">{met ? '✓' : '○'}</span> {r.label}
                  <span className="sr-only">{met ? ' (done)' : ' (missing)'}</span>
                </li>
              )
            })}
          </ul>
        </label>
        <label>
          <span>
            Confirm password <Required />
          </span>
          <PasswordInput
            value={form.confirm}
            onChange={update('confirm')}
            required
            autoComplete="new-password"
            aria-invalid={confirmMismatch}
          />
          {confirmMismatch && <span className="hint hint-error">Passwords don't match yet.</span>}
        </label>

        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </section>
  )
}

// Red star for required fields. Screen readers already announce "required" from the input itself.
function Required() {
  return (
    <span className="required-star" aria-hidden="true">
      *
    </span>
  )
}
