const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const bodyParser = require('body-parser');
const session = require('express-session'); // new

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs'); // new
app.set('views', path.join(__dirname, 'views')); // new

// Use express-session to store user data
app.use(session({
    secret: 'some-secret',
    resave: false,
    saveUninitialized: true
}));

// Tarot data & cards folder
const tarotJsonPath = "/Users/hunjunsin/Desktop/taro/tarot-images.json";
const cardsFolder = "/Users/hunjunsin/Desktop/taro/cards";
const tarotData = JSON.parse(fs.readFileSync(tarotJsonPath, 'utf8'));
const allCards = tarotData["cards"];

// Serve card images
app.use('/cards', express.static(cardsFolder));

// GET /
app.get('/', (req, res) => {
    // Initialize session-based deck if not present
    if (!req.session.remainingCards) {
        req.session.remainingCards = [...allCards];
        req.session.past = null;
        req.session.present = null;
        req.session.future = null;
        req.session.question = '';
        req.session.interpretation = null;
    }
    // Pass data to index.ejs
    res.render('index', {
        question: req.session.question || '',
        past: req.session.past,
        present: req.session.present,
        future: req.session.future,
        interpretation: req.session.interpretation,
        error: null,
        tarotCards: allCards // so EJS can embed them if needed
    });
});

// GET /draw-card/:position
app.get('/draw-card/:position', (req, res) => {
    const { position } = req.params;
    if (!req.session.question || req.session[position]) {
        return res.redirect('/');
    }
    if (req.session.remainingCards.length > 0) {
        const index = Math.floor(Math.random() * req.session.remainingCards.length);
        const card = req.session.remainingCards.splice(index, 1)[0];
        req.session[position] = card;
    }
    res.redirect('/');
});

function getRandomMeaning(card) {
    // Randomly choose between light and shadow meanings
    const type = Math.random() < 0.5 ? 'light' : 'shadow';
    const meanings = card.meanings[type] || [];
    if (meanings.length) {
        const randomMeaning = meanings[Math.floor(Math.random() * meanings.length)];
        return {
            type: type,
            meaning: randomMeaning
        };
    }
    return { type: "unknown", meaning: "의미를 찾을 수 없습니다." };
}

app.post('/interpret', async (req, res) => {
    console.log("Interpretation request received");
    
    try {
        // Check if API key exists
        if (!process.env.DEEPSEEK_API_KEY) {
            console.error("DeepSeek API key is missing");
            return res.json({ error: "API 키가 설정되지 않았습니다." });
        }

        req.session.question = req.body.question?.trim() || '';
        if (!req.session.question || !req.session.past || !req.session.present || !req.session.future) {
            console.error("Missing required data:", {
                hasQuestion: !!req.session.question,
                hasPastCard: !!req.session.past,
                hasPresentCard: !!req.session.present,
                hasFutureCard: !!req.session.future
            });
            return res.json({ error: "필요한 정보가 부족합니다." });
        }

        const deepseek_api_key = process.env.DEEPSEEK_API_KEY;
        console.log("Starting interpretation process with API key:", deepseek_api_key.substring(0, 5) + "...");
        
        const pastMeaning = getRandomMeaning(req.session.past);
        const presentMeaning = getRandomMeaning(req.session.present);
        const futureMeaning = getRandomMeaning(req.session.future);
        const prompt = `[사용자 질문] ${req.session.question}

[타로 카드]
과거 카드: ${req.session.past.name}
과거 카드 의미 ("${pastMeaning.meaning}"

현재 카드: ${req.session.present.name}
현재 카드 의미 ("${presentMeaning.meaning}"

미래 카드: ${req.session.future.name}
미래 카드 의미 ("${futureMeaning.meaning}"

[지시사항]
- 자연스러운 구어체로 3문단 이내 답변
- 과거/현재/미래 카드를 연결한 통합 해석
- 실제 행동 계획 제시 포함
- 신비로운 표현 최소화`;

        try {
            console.log("Calling DeepSeek API...");
            const payload = {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 500
            };

            // Increased timeout and added retry logic
            const axiosConfig = {
                headers: {
                    "Authorization": `Bearer ${deepseek_api_key}`,
                    "Content-Type": "application/json"
                },
                timeout: 30000, // Increased to 30 seconds
                validateStatus: (status) => status === 200, // Only accept 200 status
                maxRedirects: 5,
                retry: 3,
                retryDelay: 1000
            };

            console.log("Sending request with config:", {
                url: "https://api.deepseek.com/v1/chat/completions",
                timeout: axiosConfig.timeout,
                retries: axiosConfig.retry
            });

            const response = await axios.post(
                "https://api.deepseek.com/v1/chat/completions", 
                payload,
                axiosConfig
            );

            if (!response.data) {
                throw new Error("No response data received");
            }

            console.log("API Response received:", {
                status: response.status,
                hasData: !!response.data,
                hasChoices: !!response.data?.choices
            });

            const interpretation = response.data?.choices?.[0]?.message?.content;
            if (!interpretation) {
                throw new Error("No interpretation content in response");
            }

            req.session.interpretation = interpretation;
            return res.json({ interpretation });

        } catch (apiError) {
            console.error("DeepSeek API Error Details:", {
                message: apiError.message,
                code: apiError.code,
                status: apiError.response?.status,
                statusText: apiError.response?.statusText,
                data: apiError.response?.data,
                isAxiosError: apiError.isAxiosError,
                isTimeout: apiError.code === 'ECONNABORTED'
            });
            
            const errorMessage = apiError.code === 'ECONNABORTED' 
                ? "API 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
                : "API 호출 중 오류가 발생했습니다.";
            
            return res.json({ 
                error: errorMessage,
                details: apiError.message
            });
        }
    } catch (error) {
        console.error("General Error:", error);
        return res.json({ 
            error: "서버 오류가 발생했습니다.",
            details: error.message
        });
    }
});

// POST /api/deepseek - forward prompt to DeepSeek API
app.post('/api/deepseek', async (req, res) => {
    const deepseek_api_key = process.env.DEEPSEEK_API_KEY;
    const prompt = req.body.prompt;
    try {
        const payload = {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 500
        };
        const response = await axios.post("https://api.deepseek.com/v1/chat/completions", payload, {
            headers: {
                "Authorization": `Bearer ${deepseek_api_key}`,
                "Content-Type": "application/json"
            }
        });
        const result = response.data.choices[0].message.content;
        res.json({ success: true, response: result });
    } catch (error) {
        res.json({ success: false, error: error.toString() });
    }
});

// POST /test-api - Test DeepSeek API connection
app.post('/test-api', async (req, res) => {
    try {
        const deepseek_api_key = process.env.DEEPSEEK_API_KEY;
        console.log("Testing API connection with key:", deepseek_api_key.substring(0, 5) + "...");
        
        const testPayload = {
            model: "deepseek-chat",
            messages: [{ 
                role: "user", 
                content: "Say 'Hello' in Korean" 
            }],
            temperature: 0.7,
            max_tokens: 50
        };

        const response = await axios.post(
            "https://api.deepseek.com/v1/chat/completions",
            testPayload,
            {
                headers: {
                    "Authorization": `Bearer ${deepseek_api_key}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Full API Response:", JSON.stringify(response.data, null, 2));
        
        return res.json({
            success: true,
            message: "API test successful",
            response: response.data
        });
    } catch (error) {
        console.error("API Test Error Details:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        
        return res.json({
            success: false,
            error: error.message,
            details: error.response?.data
        });
    }
});

// POST /set-question
app.post('/set-question', (req, res) => {
    req.session.question = req.body.question?.trim() || '';
    return res.json({ success: true });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
