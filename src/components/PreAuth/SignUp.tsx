"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/hooks";
import type { PreAuthView } from "@/lib/types";

// shadcn/ui components
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// lucide icon
import { Loader2 } from "lucide-react";

interface SignUpFormState {
  email: string;
  password: string;
  message: string | null;
  error: string | null;
  isLoading: boolean;
}

interface SignUpProps {
  onNavigate: (
      view: PreAuthView,
      data?: { email?: string; message?: string }
  ) => void;
}

const SignUp: React.FC<SignUpProps> = ({ onNavigate }) => {
  const { signUp } = useAuth();
  const [formState, setFormState] = useState<SignUpFormState>({
    email: "",
    password: "",
    message: null,
    error: null,
    isLoading: false,
  });

  const handleInputChange =
      (field: keyof SignUpFormState) =>
          (e: React.ChangeEvent<HTMLInputElement>) => {
            setFormState((prev) => ({ ...prev, [field]: e.target.value }));
          };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formState.email || !formState.password) {
      setFormState((prev) => ({
        ...prev,
        error: "Email and password are required.",
      }));
      return;
    }

    setFormState((prev) => ({
      ...prev,
      error: null,
      message: null,
      isLoading: true,
    }));

    try {
      await signUp(formState.email, formState.password);

      onNavigate("login", {
        email: formState.email,
        message:
            "Sign-up successful! Please check your email to confirm your account before logging in.",
      });
    } catch (err) {
      console.error("Sign-up error:", err);
      setFormState((prev) => ({
        ...prev,
        error:
            err instanceof Error ? err.message : "An unexpected error occurred",
        isLoading: false,
      }));
    }
  };

  return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Sign Up</CardTitle>
            </CardHeader>

            <CardContent>
              {formState.error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{formState.error}</AlertDescription>
                  </Alert>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    value={formState.email}
                    onChange={handleInputChange("email")}
                    autoComplete="email"
                    disabled={formState.isLoading}
                    required
                />
              </div>

              <div className="mt-3">
                <Label htmlFor="password">Password</Label>
                <Input
                    id="password"
                    type="password"
                    value={formState.password}
                    onChange={handleInputChange("password")}
                    autoComplete="new-password"
                    disabled={formState.isLoading}
                    required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" disabled={formState.isLoading}>
                {formState.isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {formState.isLoading ? "Signing Up..." : "Sign Up"}
              </Button>
              <div>
                Already have an account?{" "}
                <Button
                    variant="link"
                    onClick={() => onNavigate("login")}
                    disabled={formState.isLoading}
                >
                  Log In
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
  );
};

export default SignUp;
