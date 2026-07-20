<?php

namespace App\Services;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIException;
use Anthropic\Messages\TextBlock;
use App\Models\Announcement;
use App\Models\Manual;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChatbotService
{
    private const FALLBACK_ANSWER = "Sorry, I'm having trouble answering right now. Please try again in a moment, or ask a staff member for help.";

    private Client $client;

    public function __construct()
    {
        $this->client = new Client(apiKey: config('services.anthropic.api_key'));
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     */
    public function ask(string $question, array $history = []): string
    {
        $messages = [];

        foreach ($history as $turn) {
            $messages[] = [
                'role' => $turn['role'] === 'assistant' ? 'assistant' : 'user',
                'content' => $turn['content'],
            ];
        }

        $messages[] = ['role' => 'user', 'content' => $question];

        try {
            $response = $this->client->messages->create(
                maxTokens: 1024,
                messages: $messages,
                model: config('services.anthropic.model'),
                system: $this->buildSystemPrompt(),
            );
        } catch (APIException $e) {
            Log::error('Chatbot API error: '.$e->getMessage());

            return self::FALLBACK_ANSWER;
        }

        foreach ($response->content as $block) {
            if ($block instanceof TextBlock) {
                return $block->text;
            }
        }

        return self::FALLBACK_ANSWER;
    }

    private function buildSystemPrompt(): string
    {
        $manuals = Manual::published()
            ->with('category')
            ->orderBy('title')
            ->limit(50)
            ->get();

        $announcements = Announcement::published()
            ->orderByDesc('published_at')
            ->limit(30)
            ->get();

        $manualSection = $manuals->isEmpty()
            ? 'No manual entries are published yet.'
            : $manuals->map(function (Manual $manual): string {
                $content = Str::limit($manual->content, 2000);

                return "### {$manual->title} ({$manual->category->name})\n{$content}";
            })->implode("\n\n");

        $announcementSection = $announcements->isEmpty()
            ? 'No announcements are published yet.'
            : $announcements->map(function (Announcement $announcement): string {
                $meta = '';

                if ($announcement->type === 'event' && $announcement->event_start_at) {
                    $meta = ' | Event date: '.$announcement->event_start_at->toDayDateTimeString();

                    if ($announcement->location) {
                        $meta .= " at {$announcement->location}";
                    }
                }

                $content = Str::limit($announcement->content, 1000);

                return "### {$announcement->title} ({$announcement->type}{$meta})\n{$content}";
            })->implode("\n\n");

        return <<<PROMPT
        You are the AI assistant for the AI-Powered Smart Information Kiosk at Aemilianum College Inc. You answer questions from students, faculty, and visitors about school policies, procedures, and events on a public touchscreen kiosk.

        Answer ONLY using the reference material below. If the answer isn't in the reference material, say you don't have that information and suggest the person visit the registrar's office or ask a staff member. Do not make up policies, dates, or details.

        Keep answers short, clear, and friendly — suited for a touchscreen kiosk, not a long essay.

        ## School Manual
        {$manualSection}

        ## Announcements & Events
        {$announcementSection}
        PROMPT;
    }
}
