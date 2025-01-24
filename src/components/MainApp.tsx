'use client';

import React, { Suspense, useEffect } from 'react';
import { FileNodeType } from '@/lib/powersync/DrizzleSchema.ts';
import { useAuth, useData, useUI } from '@/hooks';

import LeftSidebar from './LeftSidebar/LeftSidebar';
import RightSidebar from './RightSidebar';
import MergedDropBoxes from '@/components/SampleGroupView/MergedDropboxes.tsx';
import SampleGroupMetadataComponent from '@/components/SampleGroupView/SampleGroupMetadataComponent.tsx';
import ContainerScreen from '@/components/Container/ContainerScreen';
import GlobeComponent from '@/components/GlobeComponent.tsx';
import AccountModal from './LeftSidebar/Modals/AccountModal.tsx';
// Remove: import ErrorMessage from "./ErrorMessage";

import ChatWidget from '@/components/Chatbot/ChatWidget';
import { Loader2 } from 'lucide-react';

// 1) Import useToast from your shadcn toast utility
import { useToast } from '@/hooks/use-toast';

const MainApp: React.FC = () => {
  // ---- Hooks & Setup ----
  const auth = useAuth();
  const data = useData();
  const ui = useUI();

  const { error: authError, setError: setAuthError } = auth;
  const { error: dataError } = data;
  const {
    selectedLeftItem,
    showAccountActions,
    errorMessage,
    setErrorMessage,
  } = ui;

  const displayedError = authError || dataError || errorMessage;

  // 2) Initialize the shadcn toast
  const { toast } = useToast();

  // ---- Effects ----
  // Whenever `displayedError` changes, trigger the toast
  useEffect(() => {
    if (displayedError) {
      toast({
        title: 'Error',
        description: String(displayedError),
        variant: 'destructive',
        // If you want a custom duration or action, specify them here:
        // duration: 5000, // 5 seconds
      });
      // If you still want to clear the error from state after 5s:
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setAuthError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [displayedError, toast, setErrorMessage, setAuthError]);

  // ---- Determine which content to show (Globe vs. Non-Globe) ----
  const isGlobe =
    !selectedLeftItem ||
    (selectedLeftItem.type !== FileNodeType.SampleGroup &&
      selectedLeftItem.type !== FileNodeType.Container);

  function renderNonGlobeContent() {
    switch (selectedLeftItem?.type) {
      case FileNodeType.SampleGroup:
        return (
          <div className='w-full h-full overflow-auto'>
            <SampleGroupMetadataComponent />
            <MergedDropBoxes onError={setErrorMessage} />
          </div>
        );
      case FileNodeType.Container:
        return (
          <div className='w-full h-full overflow-auto'>
            <ContainerScreen />
          </div>
        );
      default:
        return null;
    }
  }

  // ---- Render ----
  return (
    <div className='w-screen h-screen'>
      {isGlobe && (
        <div className='absolute'>
          <Suspense
            fallback={
              <div style={{ marginBottom: '1rem' }}>
                <Loader2 className='animate-spin' />
              </div>
            }
          >
            <GlobeComponent />
          </Suspense>
        </div>
      )}

      <div className='z-10 w-full h-full flex'>
        <div className='overflow-auto pointer-events-auto'>
          <LeftSidebar />
        </div>

        {isGlobe ? (
          <div className={'pointer-events-auto'}>
            <RightSidebar />
          </div>
        ) : (
          <div className='flex-1 pointer-events-auto'>
            {renderNonGlobeContent()}
          </div>
        )}
      </div>

      {/* Chat Widget */}
      <ChatWidget />

      {/* Account Modal */}
      {showAccountActions && <AccountModal />}
    </div>
  );
};

export default React.memo(MainApp);
