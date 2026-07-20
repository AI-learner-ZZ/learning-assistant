import React, { useEffect, useState } from 'react'
import { Lock, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { getToken, setToken } from '@/lib/httpApi'

interface LoginGateProps {
  children: React.ReactNode
}

export function LoginGate({ children }: LoginGateProps): JSX.Element {
  const isZh = navigator.language.toLowerCase().startsWith('zh')
  const t = (zh: string, en: string): string => (isZh ? zh : en)
  const [status, setStatus] = useState<'checking' | 'login' | 'ready'>('checking')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setStatus('login')
      return
    }
    fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setStatus(res.ok ? 'ready' : 'login'))
      .catch(() => setStatus('login'))
  }, [])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (res.status === 429) {
        setError(t('尝试次数过多，请稍后再试', 'Too many attempts — try again in a minute'))
        return
      }
      if (!res.ok) {
        setError(t('用户名或密码错误', 'Wrong username or password'))
        return
      }
      const data = (await res.json()) as { token: string }
      setToken(data.token)
      setStatus('ready')
    } catch {
      setError(t('无法连接到主机', 'Cannot reach the host'))
    } finally {
      setBusy(false)
    }
  }

  if (status === 'checking') {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'login') {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <form onSubmit={submit} className="w-full max-w-xs space-y-4">
          <div className="text-center">
            <Lock className="h-10 w-10 mx-auto text-primary" />
            <h1 className="mt-3 text-lg font-semibold">{t('登录学习助手', 'Sign in to Learning Assistant')}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('输入在桌面端设置的用户名和密码', 'Use the username and password set on the desktop app')}
            </p>
          </div>
          <Input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={t('用户名', 'Username')}
            autoComplete="username"
          />
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('密码', 'Password')}
            autoComplete="current-password"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !username || !password}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('登录', 'Sign in')}
          </Button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
