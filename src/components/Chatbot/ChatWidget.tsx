// src/components/ChatWidget.tsx

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import {useAuthStore} from "@/stores/authStore.ts";

export function ChatWidget() {

    const [error, setError] = useState<string | null>(null)
    const { userId, organizationId, user } = useAuthStore()
    const email = user?.email;
    async function handleOpenChat() {
        setError(null)
        const API_KEY = import.meta.env.VITE_AYD_API_KEY
        invoke('create_chatbot_session', {
            api_key: API_KEY,
            email: email,
            user_id: userId,
            org_id: organizationId
        }).catch((error) => setError(error.message));
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-center space-y-2 pointer-events-auto">
            {error && <p className="text-red-500">{error}</p>}

            <Button onClick={handleOpenChat} variant="default" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Open Chatbot
            </Button>
        </div>
    )
}

export default ChatWidget
