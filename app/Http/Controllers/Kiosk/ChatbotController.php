<?php

namespace App\Http\Controllers\Kiosk;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreChatbotFeedbackRequest;
use App\Http\Requests\StoreChatbotMessageRequest;
use App\Models\ChatbotLog;
use App\Services\ChatbotService;
use Illuminate\Http\JsonResponse;

class ChatbotController extends Controller
{
    public function __construct(private readonly ChatbotService $chatbot) {}

    public function ask(StoreChatbotMessageRequest $request): JsonResponse
    {
        $answer = $this->chatbot->ask(
            $request->string('message')->toString(),
            $request->array('history'),
        );

        $log = ChatbotLog::create([
            'session_id' => $request->string('session_id')->toString(),
            'question' => $request->string('message')->toString(),
            'answer' => $answer,
        ]);

        return response()->json([
            'answer' => $answer,
            'log_id' => $log->id,
        ]);
    }

    public function feedback(StoreChatbotFeedbackRequest $request, ChatbotLog $chatbotLog): JsonResponse
    {
        $chatbotLog->update(['was_helpful' => $request->boolean('helpful')]);

        return response()->json(['status' => 'ok']);
    }
}
