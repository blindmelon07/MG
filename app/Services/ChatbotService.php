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
    private const FALLBACK_ANSWER = "I couldn't find anything about that in the school manual or announcements. Please ask a staff member or visit the registrar's office for help.";

    /** @var list<string> */
    private const STOPWORDS = [
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'do', 'does', 'did', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
        'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'when',
        'where', 'who', 'why', 'how', 'which', 'can', 'could', 'would',
        'should', 'will', 'shall', 'of', 'in', 'on', 'at', 'to', 'for',
        'and', 'or', 'but', 'with', 'about', 'this', 'that', 'these',
        'those', 'me', 'us', 'them', 'please', 'tell', 'know', 'there',
    ];

    private ?Client $client;

    public function __construct()
    {
        $this->client = config('services.anthropic.enabled')
            ? new Client(apiKey: config('services.anthropic.api_key'))
            : null;
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     */
    public function ask(string $question, array $history = []): string
    {
        if ($this->client !== null) {
            $answer = $this->askClaude($question, $history);

            if ($answer !== null) {
                return $answer;
            }
        }

        return $this->answerLocally($question);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $history
     */
    private function askClaude(string $question, array $history): ?string
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
                system: $this->buildGroundingContext(),
            );
        } catch (APIException $e) {
            Log::error('Chatbot API error: '.$e->getMessage());

            return null;
        }

        foreach ($response->content as $block) {
            if ($block instanceof TextBlock) {
                return $block->text;
            }
        }

        return null;
    }

    /**
     * Free, offline fallback: keyword-matches the question against published
     * manuals and announcements instead of calling an external API.
     */
    private function answerLocally(string $question): string
    {
        $keywords = $this->extractKeywords($question);

        if ($keywords === []) {
            return self::FALLBACK_ANSWER;
        }

        $best = null;
        $bestScore = 0;

        foreach (Manual::published()->get() as $manual) {
            $score = $this->score($keywords, $manual->title, $manual->content);

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $manual;
            }
        }

        foreach (Announcement::published()->get() as $announcement) {
            $score = $this->score($keywords, $announcement->title, $announcement->content);

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $announcement;
            }
        }

        return $best === null ? self::FALLBACK_ANSWER : $this->formatLocalAnswer($best);
    }

    /**
     * @return list<string>
     */
    private function extractKeywords(string $question): array
    {
        preg_match_all('/[a-z0-9]+/', strtolower($question), $matches);

        $words = array_filter(
            $matches[0],
            fn (string $word): bool => strlen($word) >= 3 && ! in_array($word, self::STOPWORDS, true),
        );

        return array_values(array_unique($words));
    }

    /**
     * @param  list<string>  $keywords
     */
    private function score(array $keywords, string $title, string $content): int
    {
        $titleLower = strtolower($title);
        $contentLower = strtolower($content);
        $score = 0;

        foreach ($keywords as $keyword) {
            $score += substr_count($titleLower, $keyword) * 3;
            $score += substr_count($contentLower, $keyword);
        }

        return $score;
    }

    private function formatLocalAnswer(Manual|Announcement $model): string
    {
        $normalized = preg_replace('/\s+/', ' ', trim($model->content));
        $excerpt = Str::limit($normalized ?: $model->content, 500);

        if ($model instanceof Manual) {
            return "**{$model->title}**\n\n{$excerpt}\n\nSee the School Manual section for the full entry.";
        }

        $meta = '';

        if ($model->type === 'event' && $model->event_start_at) {
            $meta = ' — '.$model->event_start_at->toDayDateTimeString();

            if ($model->location) {
                $meta .= " at {$model->location}";
            }
        }

        return "**{$model->title}**{$meta}\n\n{$excerpt}\n\nSee the Announcements & Events section for more.";
    }

    private function buildGroundingContext(): string
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
