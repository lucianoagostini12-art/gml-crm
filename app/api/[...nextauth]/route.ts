import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"

// Cliente de Supabase para Auth (usando variables de entorno que configuraremos luego)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseKey)

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // 1. Validar inputs
        if (!credentials?.email || !credentials?.password) return null

        // 2. Autenticar con Supabase (La "magia" real)
        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        })

        if (error || !data.user) {
          // Si falla Supabase, devolvemos null (error de login)
          console.error("Error Auth Supabase:", error)
          return null
        }

        // 3. Devolver el objeto usuario para la sesión
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || "Usuario GML",
          role: data.user.user_metadata?.role || "seller", // Asumimos que guardamos el rol en metadata
        }
      }
    })
  ],
  pages: {
    signIn: '/login', // Redirigir aquí si hay error
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.role = token.role // Pasamos el rol a la sesión del frontend
      }
      return session
    }
  }
})

export { handler as GET, handler as POST }