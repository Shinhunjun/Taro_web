import json
import random
import streamlit as st
from PIL import Image
import os
import requests
from dotenv import load_dotenv
import time
import streamlit.components.v1 as components

adsense_header = """
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6885920070996702"
     crossorigin="anonymous"></script>
"""

components.html(adsense_header, height=0)  # 헤더에 삽입

# Load environment variables
load_dotenv()
deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")

# Set paths for JSON and images
json_path = "/Users/hunjunsin/Desktop/Jun/langchain/tarot-images.json"
cards_folder = "/Users/hunjunsin/Desktop/Jun/langchain/cards"

# Load tarot card data
with open(json_path, "r") as file:
    tarot_data = json.load(file)
tarot_cards = tarot_data["cards"]

# Streamlit UI
st.markdown("""
    <h1 style='text-align:center; font-size:2.5em; color:#4B0082; font-family:fantasy; 
    text-shadow: 1px 1px 3px #000000;'>🔮 당신의 여정은 어디로 향하고 있나요?</h1>
""", unsafe_allow_html=True)

st.markdown("---")
components.html("""
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-6885920070996702"
     data-ad-slot="1234567890"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>
     (adsbygoogle = window.adsbygoogle || []).push({});
</script>
""", height=100)  # 높이 조정 가능
st.markdown("---")

# User question input
user_question = st.text_input("❓ *궁금한 점을 입력하세요:*", placeholder="예: 나의 진로는 어떻게 될까요?")

# Function to call DeepSeek API
def get_deepseek_response(prompt):
    headers = {
        "Authorization": f"Bearer {deepseek_api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }
    
    try:
        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        st.error(f"DeepSeek API 오류: {str(e)}")
        return None

# Initialize session state for card selection
if 'past_card' not in st.session_state:
    st.session_state.past_card = None
if 'present_card' not in st.session_state:
    st.session_state.present_card = None
if 'future_card' not in st.session_state:
    st.session_state.future_card = None
if 'remaining_cards' not in st.session_state:
    st.session_state.remaining_cards = tarot_cards.copy()

# Function to select a card
def select_card(position):
    if st.session_state.remaining_cards:
        selected_card = random.choice(st.session_state.remaining_cards)
        st.session_state[position] = selected_card
        st.session_state.remaining_cards.remove(selected_card)

# Card selection section
st.markdown("## 🃏 타로 카드 선택")

# 광고 배치
cols_ad = st.columns([1, 2, 1])  # 중앙 열에 광고 배치
with cols_ad[1]:
    components.html("""
    <ins class="adsbygoogle"
         style="display:block; text-align:center;"
         data-ad-client="ca-pub-6885920070996702"
         data-ad-slot="0987654321"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>
         (adsbygoogle = window.adsbygoogle || []).push({});
    </script>
    """, height=250)
    
# Show warning if no question is entered
if not user_question:
    st.warning("❗ 질문을 입력해야 타로 카드를 뽑을 수 있습니다.")

# Card selection buttons and images
cols = st.columns(3)
positions = ['과거', '현재', '미래']
session_keys = ['past_card', 'present_card', 'future_card']

for i, col in enumerate(cols):
    with col:
        if st.button(f"{positions[i]} 카드 뽑기", key=f"{positions[i]}_btn", disabled=not user_question):
            select_card(session_keys[i])
        if st.session_state[session_keys[i]]:
            st.image(os.path.join(cards_folder, st.session_state[session_keys[i]]["img"]), width=150)

# Display card interpretation results
if all(st.session_state[key] for key in session_keys) and user_question:
    st.markdown("### ✨ 타로 카드 해석")

    with st.spinner('🔮 타로 카드를 해석 중입니다... 잠시만 기다려주세요...'):
        # Progress bar
        progress_bar = st.progress(0)
        
        # Extract meanings
        def get_random_meaning(card):
            meanings = card['meanings'].get('light', []) + card['meanings'].get('shadow', [])
            return random.choice(meanings) if meanings else "의미를 찾을 수 없습니다."

        progress_bar.progress(20)
        past_meaning = get_random_meaning(st.session_state['past_card'])
        present_meaning = get_random_meaning(st.session_state['present_card'])
        future_meaning = get_random_meaning(st.session_state['future_card'])
        
        # Optimize prompt
        optimized_prompt = f"""
        [사용자 질문] {user_question}

        [타로 카드]
        과거: {st.session_state['past_card']['name']} - "{past_meaning}"
        현재: {st.session_state['present_card']['name']} - "{present_meaning}"
        미래: {st.session_state['future_card']['name']} - "{future_meaning}"

        [지시사항]
        - 자연스러운 구어체로 3문단 이내 답변
        - 과거/현재/미래 카드를 연결한 통합 해석
        - 실제 행동 계획 제시 포함
        - 신비로운 표현 최소화
        """
        
        # Update progress bar
        progress_bar.progress(40)
        for percent in range(40, 61, 2):
            progress_bar.progress(percent)
            time.sleep(0.03)
        
        # Call API
        response = get_deepseek_response(optimized_prompt)
        
        # Update progress bar
        for percent in range(60, 81, 2):
            progress_bar.progress(percent)
            time.sleep(0.04)
        
        if response:
            for percent in range(80, 101, 5):
                progress_bar.progress(percent)
                time.sleep(0.05)
            st.success(response)
            
                    # 해석 결과 하단 광고
            st.markdown("---")
            components.html("""
            <ins class="adsbygoogle"
                style="display:block"
                data-ad-client="ca-pub-6885920070996702"
                data-ad-slot="5647382910"
                data-ad-format="rectangle"
                data-full-width-responsive="true"></ins>
            <script>
                (adsbygoogle = window.adsbygoogle || []).push({});
            </script>
            """, height=300)
            st.markdown("---")
        else:
            progress_bar.progress(0)
            st.error("오류 발생")

    progress_bar.empty()
    
# 🚨 필수 공지사항 추가
st.markdown("""
<div style="text-align:center; font-size:0.8em; color:#666; margin-top:50px;">
    <p>본 서비스는 Google 애드센스를 통해 광고를 제공합니다</p>
    <p><a href="/privacy" target="_blank">개인정보처리방침</a> | <a href="/terms" target="_blank">이용약관</a></p>
</div>
""", unsafe_allow_html=True)
