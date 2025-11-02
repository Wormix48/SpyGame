import { Player, GameState, Question, QuestionType } from './types';
import { QUESTIONS } from './data/questions';
import { GoogleGenAI, Type } from '@google/genai';

export const generateId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0,
      v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const checkWinConditions = (players: Player[]): 'PLAYERS' | 'SPIES' | null => {
    const currentActivePlayers = players.filter(p => !p.isEliminated);
    const currentActiveSpies = currentActivePlayers.filter(p => p.isSpy);
    const currentActiveInnocents = currentActivePlayers.filter(p => !p.isSpy);

    if (currentActiveSpies.length === 0) {
        return 'PLAYERS';
    }
    if (currentActiveSpies.length >= currentActiveInnocents.length) {
        return 'SPIES';
    }
    return null;
};

export const processImage = (file: File, maxSize = 96): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = maxSize;
                canvas.height = maxSize;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }

                // Crop to a square from the center of the image
                const sourceSize = Math.min(img.width, img.height);
                const sourceX = (img.width - sourceSize) / 2;
                const sourceY = (img.height - sourceSize) / 2;

                ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, maxSize, maxSize);
                
                // Using JPG with quality 0.7 to drastically reduce size
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

export const generateNewQuestion = async (
    currentState: GameState
): Promise<{ newQuestion: Question | null; usedQuestionIds: number[]; usedQuestionTexts: string[]; error?: string }> => {
    let newQuestion: Question | null = null;
    let usedQuestionIds = [...(currentState.usedQuestionIds || [])];
    let usedQuestionTexts = [...(currentState.usedQuestionTexts || [])];
    let error: string | undefined;

    try {
        if (currentState.questionSource === 'ai') {
            const apiKey = localStorage.getItem('gemini-api-key');
            if (!apiKey) {
                throw new Error("API key not found");
            }

            const questionTypes: QuestionType[] = ['YES_NO', 'SCALE_4', 'PLAYERS'];
            const randomType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
            
            const ai = new GoogleGenAI({ apiKey: apiKey });

            let typeDescription = '';
            switch (randomType) {
                case 'YES_NO':
                    typeDescription = 'Это должен быть вопрос, на который можно ответить только "Да" или "Нет". Например: "Ты когда-нибудь прыгал(а) с парашютом?".';
                    break;
                case 'SCALE_4':
                    typeDescription = 'Это должно быть утверждение от первого лица, с которым игрок может согласиться или не согласиться. Ответы будут "Совсем нет", "Скорее нет", "Скорее да", "Да". Например: "Я считаю себя творческой личностью.".';
                    break;
                case 'PLAYERS':
                    typeDescription = 'Это должен быть вопрос, который просит выбрать одного из других игроков. Например: "Кто из игроков самый веселый?".';
                    break;
            }

            let prompt = `Сгенерируй один вопрос на русском языке для компанейской игры "Найди Шпиона".

Требования к вопросу:
1. Тип вопроса: ${randomType}.
2. Формулировка: ${typeDescription}
3. Самодостаточность: Вопрос должен быть полным и понятным без какого-либо дополнительного контекста. Избегай вопросов, ссылающихся на несуществующий или неопределенный "предмет", "ситуацию", "человека" и т.д. Вопрос не должен быть частью диалога. Например, вопрос "Ты бы сделал это снова?" является плохим, так как "это" не определено. А вопрос "Ты предпочитаешь использовать этот предмет ночью?" - плохой, так как "предмет" не определен.
4. Уникальность: Не используй и не перефразируй эти вопросы: "${usedQuestionTexts.join('", "')}".
${currentState.familyFriendly ? `5. Безопасность: Вопрос должен быть абсолютно безопасным и подходящим для семейной аудитории и детей.` : ''}

В ответе верни ТОЛЬКО JSON объект с одним ключом "text", содержащим текст вопроса. Не добавляй никаких других пояснений или форматирования.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-flash-latest', contents: prompt,
                config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { text: { type: Type.STRING } }, required: ['text'] } }
            });
            const questionText = JSON.parse(response.text).text;
            let answers: string[] = [];
            if (randomType === 'YES_NO') answers = ['Да', 'Нет'];
            if (randomType === 'SCALE_4') answers = ['Совсем нет', 'Скорее нет', 'Скорее да', 'Да'];
            newQuestion = { id: Date.now(), text: questionText, type: randomType, answers, familyFriendly: currentState.familyFriendly };
        } else {
            let availableQuestions = QUESTIONS.filter(q => !usedQuestionIds.includes(q.id) && (currentState.familyFriendly ? q.familyFriendly : true));
            if (availableQuestions.length === 0) { // Reset if we run out
                usedQuestionIds = [];
                availableQuestions = QUESTIONS.filter(q => currentState.familyFriendly ? q.familyFriendly : true);
            }
            newQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
        }
    } catch (err: any) {
        console.error("Error generating question, falling back:", err);
        if (currentState.questionSource === 'ai') {
             error = 'Ошибка генерации вопроса ИИ. Используется вопрос из библиотеки.';
             if (err.message?.includes('API key not valid')) {
                error = 'Ваш API ключ недействителен. Используется вопрос из библиотеки.';
            } else if (err.message?.includes('API key not found')) {
                error = 'API ключ не найден. Пожалуйста, введите его в настройках. Используется вопрос из библиотеки.';
            }
        }
        
        // Fallback to library
        let availableQuestions = QUESTIONS.filter(q => !usedQuestionIds.includes(q.id) && (currentState.familyFriendly ? q.familyFriendly : true));
        if (availableQuestions.length === 0) {
             usedQuestionIds = [];
             availableQuestions = QUESTIONS.filter(q => currentState.familyFriendly ? q.familyFriendly : true);
        }
        newQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    }

    if (newQuestion) {
        usedQuestionIds.push(newQuestion.id);
        usedQuestionTexts.push(newQuestion.text);
    }

    return { newQuestion, usedQuestionIds, usedQuestionTexts, error };
};