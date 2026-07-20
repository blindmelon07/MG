import { Bot, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ChatbotController from '@/actions/App/Http/Controllers/Kiosk/ChatbotController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
    logId?: number;
    feedback?: boolean | null;
};

function getXsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);

    return match ? decodeURIComponent(match[1]) : '';
}

function getSessionId(): string {
    const key = 'kiosk_chat_session_id';
    let id = localStorage.getItem(key);

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(key, id);
    }

    return id;
}

export default function ChatbotWidget() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }, [messages, sending]);

    async function sendMessage(e: React.FormEvent) {
        e.preventDefault();
        const question = input.trim();

        if (!question || sending) {
            return;
        }

        const history = messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        setMessages((prev) => [...prev, { role: 'user', content: question }]);
        setInput('');
        setSending(true);

        try {
            const response = await fetch(ChatbotController.ask().url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({
                    session_id: getSessionId(),
                    message: question,
                    history,
                }),
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const data = (await response.json()) as {
                answer: string;
                log_id: number;
            };

            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: data.answer,
                    logId: data.log_id,
                    feedback: null,
                },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content:
                        'Sorry, something went wrong reaching the assistant. Please try again.',
                },
            ]);
        } finally {
            setSending(false);
        }
    }

    async function sendFeedback(index: number, helpful: boolean) {
        const message = messages[index];

        if (!message.logId) {
            return;
        }

        setMessages((prev) =>
            prev.map((m, i) => (i === index ? { ...m, feedback: helpful } : m)),
        );

        await fetch(ChatbotController.feedback(message.logId).url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': getXsrfToken(),
            },
            body: JSON.stringify({ helpful }),
        });
    }

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                size="icon"
                className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg"
            >
                <Bot className="size-6" />
                <span className="sr-only">Ask the AI Assistant</span>
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent
                    side="right"
                    className="flex w-full flex-col sm:max-w-md"
                >
                    <SheetHeader>
                        <SheetTitle>Ask the AI Assistant</SheetTitle>
                    </SheetHeader>

                    <div
                        ref={scrollRef}
                        className="flex-1 space-y-3 overflow-y-auto px-4"
                    >
                        {messages.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Ask about school policies, procedures, or
                                upcoming events.
                            </p>
                        )}

                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={cn(
                                    'flex',
                                    message.role === 'user'
                                        ? 'justify-end'
                                        : 'justify-start',
                                )}
                            >
                                <div
                                    className={cn(
                                        'max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap',
                                        message.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-foreground',
                                    )}
                                >
                                    {message.content}

                                    {message.role === 'assistant' &&
                                        message.logId && (
                                            <div className="mt-2 flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-6"
                                                    disabled={
                                                        message.feedback !=
                                                        null
                                                    }
                                                    onClick={() =>
                                                        sendFeedback(
                                                            index,
                                                            true,
                                                        )
                                                    }
                                                >
                                                    <ThumbsUp
                                                        className={cn(
                                                            'size-3.5',
                                                            message.feedback ===
                                                                true &&
                                                                'text-primary',
                                                        )}
                                                    />
                                                    <span className="sr-only">
                                                        Helpful
                                                    </span>
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-6"
                                                    disabled={
                                                        message.feedback !=
                                                        null
                                                    }
                                                    onClick={() =>
                                                        sendFeedback(
                                                            index,
                                                            false,
                                                        )
                                                    }
                                                >
                                                    <ThumbsDown
                                                        className={cn(
                                                            'size-3.5',
                                                            message.feedback ===
                                                                false &&
                                                                'text-destructive',
                                                        )}
                                                    />
                                                    <span className="sr-only">
                                                        Not helpful
                                                    </span>
                                                </Button>
                                            </div>
                                        )}
                                </div>
                            </div>
                        ))}

                        {sending && (
                            <div className="flex justify-start">
                                <div className="rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                                    Thinking...
                                </div>
                            </div>
                        )}
                    </div>

                    <form
                        onSubmit={sendMessage}
                        className="flex items-center gap-2 border-t p-4"
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your question..."
                            disabled={sending}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={sending || !input.trim()}
                        >
                            <Send className="size-4" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
                </SheetContent>
            </Sheet>
        </>
    );
}
