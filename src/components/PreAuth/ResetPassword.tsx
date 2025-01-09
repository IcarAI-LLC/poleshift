"use client";

import React, { useState, useCallback } from "react";
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

interface ResetPasswordProps {
  onNavigate: (view: PreAuthView) => void;
}

interface FormState {
  email: string;
  message: string | null;
  error: string | null;
  isLoading: boolean;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
  const { resetPassword } = useAuth();
  const [formState, setFormState] = useState<FormState>({
    email: "",
    message: null,
    error: null,
    isLoading: false,
  });

  const handleSubmit = useCallback(
      async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setFormState((prev) => ({
          ...prev,
          error: null,
          message: null,
          isLoading: true,
        }));

        try {
          await resetPassword(formState.email);
          setFormState((prev) => ({
            ...prev,
            message: "Password reset email sent. Check your inbox.",
            isLoading: false,
          }));
        } catch (err) {
          console.error("Reset Password error:", err);
          setFormState((prev) => ({
            ...prev,
            error:
                err instanceof Error ? err.message : "An unexpected error occurred",
            isLoading: false,
          }));
        }
      },
      [formState.email, resetPassword]
  );

  const handleEmailChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormState((prev) => ({ ...prev, email: e.target.value }));
      },
      []
  );

  return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
            </CardHeader>

            <CardContent>
              {formState.error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{formState.error}</AlertDescription>
                  </Alert>
              )}

              {formState.message && (
                  <Alert variant="default">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{formState.message}</AlertDescription>
                  </Alert>
              )}

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    value={formState.email}
                    onChange={handleEmailChange}
                    required
                    disabled={formState.isLoading || !!formState.message}
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button
                  type="submit"
                  disabled={formState.isLoading || !!formState.message}
              >
                {formState.isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {formState.isLoading ? "Sending..." : "Reset Password"}
              </Button>

              <div>
                Remember your password?{" "}
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

export default ResetPassword;
