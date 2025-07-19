"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
    } else {
      setMessage("Signed in successfully! Redirecting...")
      router.push("/") // Redirect to the main app page
    }
    setLoading(false)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/api/auth/callback`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
    } else {
      setMessage("Check your email for a confirmation link to complete your sign-up!")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-cyan-400 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-black/20 border-purple-500/20 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-cyan-400">Welcome to P.U.P.U.</CardTitle>
          <CardDescription className="text-cyan-300">Sign in or create an account to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-cyan-300 mb-1">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-gray-800/50 border-cyan-500/30 text-cyan-100 placeholder-cyan-400/50"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-cyan-300 mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-gray-800/50 border-cyan-500/30 text-cyan-100 placeholder-cyan-400/50"
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {message && <p className="text-green-500 text-sm text-center">{message}</p>}
            <div className="flex gap-4">
              <Button
                type="submit"
                onClick={handleSignIn}
                disabled={loading}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {loading ? "Signing In..." : "Sign In"}
              </Button>
              <Button
                type="submit"
                onClick={handleSignUp}
                disabled={loading}
                variant="outline"
                className="flex-1 border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 bg-transparent"
              >
                {loading ? "Signing Up..." : "Sign Up"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
