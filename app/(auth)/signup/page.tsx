"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { AuthRepository } from "@/lib/repositories/auth.repository"
import { signupSchema, type SignupInput } from "@/lib/schemas/auth.schema"

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)
  const supabase = createClient()
  const authRepo = new AuthRepository(supabase)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  })

  async function onSubmit(data: SignupInput) {
    setIsLoading(true)
    setError(null)
    
    try {
      const { data: authData, error: signUpError } = await authRepo.signUp(data)
      
      if (signUpError) throw new Error(signUpError)
      
      if (!authData?.session) {
        setConfirmationPending(true)
        return
      }
      router.push("/patients")
      router.refresh()
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to create account. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (confirmationPending) return (
    <div role="status" className="flex flex-col gap-4 text-center">
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p>Follow the confirmation link to activate your account, then sign in to your workspace.</p>
      <Link href="/login" className="text-primary underline">Back to Sign In</Link>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-gray-500 mt-2">Start organizing your practice</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="displayName">Full Name & Title</Label>
          <Input 
            id="displayName" 
            placeholder="Dr. Jane Doe" 
            disabled={isLoading}
            {...register("displayName")}
          />
          {errors.displayName && (
            <p className="text-xs text-red-500 font-medium">{errors.displayName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="doctor@clinic.com" 
            disabled={isLoading}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input 
            id="password" 
            type="password" 
            placeholder="At least 6 characters"
            disabled={isLoading}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create Account"}
        </Button>
      </form>

      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Sign In
        </Link>
      </div>
    </div>
  )
}
