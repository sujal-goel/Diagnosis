"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sector } from "recharts"
import { useSearchParams } from "next/navigation"
import confetti from "canvas-confetti"
import Link from "next/link"
import ChatMessage from "../../components/ChatMessage"
import ChartDisplay from "../../components/ChartDisplay"
import "../../styles/chatbot.css"
import { v4 as uuidv4 } from "uuid" // Install with: npm install uuid
const modelUrl = process.env.NEXT_PUBLIC_MODEL_URL ;
export default function ChatbotPage() {

  const searchParams = useSearchParams()

  // 1. Initialize session ID from localStorage or generate a new one
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("session_id") || uuidv4()
    }
    return uuidv4()
  })
  const initialInput = searchParams.get("input") || ""
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState(initialInput)
  const [isLoading, setIsLoading] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [activeChart, setActiveChart] = useState("bar")
  const [activeIndex, setActiveIndex] = useState(0)
  const [chartData, setChartData] = useState({
    type: "bar",
    title: "Sample Data",
    data: [
      { name: "Jan", value: 400 },
      { name: "Feb", value: 300 },
      { name: "Mar", value: 600 },
      { name: "Apr", value: 800 },
      { name: "May", value: 500 },
      { name: "Jun", value: 900 },
    ],
  })

  const messagesEndRef = useRef(null)
  const canvasRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
    // 2. Store session ID in localStorage if it changes
  useEffect(() => {
      if (typeof window !== "undefined" && sessionId) {
        localStorage.setItem("session_id", sessionId)
      }
    }, [sessionId])
  

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Demo messages on first load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messages.length === 0) {
        setMessages([
          {
            id: "welcome",
            content:
              "👋 Hi there! I help you monitor and analyze important health parameters like glucose levels, blood pressure, and more to support early detection and management of diabetes.",
            role: "assistant",
          },
        ])
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [messages.length])

  const handleInputChange = (e) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      content: input,
      role: "user",
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      // Add a temporary assistant message that will be updated as the response streams in
      setMessages((prev) => [
        ...prev,
        {
          id: "assistant-streaming",
          content: "",
          role: "assistant",
        },
      ])

      const response = await fetch(`${modelUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_name: "Samantha",
          diabetic_type: "Pre-diabetic",
          session_id: sessionId, // Use the sessionId from state
          user_input: input,
          // ...add any other health data fields if needed...
        }),
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`)
      }

      // Parse JSON response
      const data = await response.json()
      console.log("API Response:", data)

      // 3. Update session ID if backend returns a new one
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id)
      }

      const responseText = data.response

      // Update the assistant message with the full response
      setMessages((prev) => {
        const newMessages = [...prev]
        const assistantMsgIndex = newMessages.findIndex((m) => m.id === "assistant-streaming")

        if (assistantMsgIndex >= 0) {
          // Clean the response text to remove any streaming artifacts
          let content = responseText

          // Check if the message contains chart data
          if (content.includes("CHART_DATA:")) {
            try {
              console.log("Found chart data in response")
              const chartDataStr = content.split("CHART_DATA:")[1].split("END_CHART_DATA")[0]
              console.log("Chart data string:", chartDataStr)
              const chartData = JSON.parse(chartDataStr)
              console.log("Parsed chart data:", chartData)
              setChartData(chartData)
              setActiveChart(chartData.type || "bar")
              setShowChart(true)

              // Show only the text part of the response
              content = content.split("CHART_DATA:")[0]

              // Trigger confetti effect when new chart is displayed
              setTimeout(() => {
                const canvas = document.createElement("canvas")
                canvas.style.position = "fixed"
                canvas.style.inset = "0"
                canvas.style.width = "100vw"
                canvas.style.height = "100vh"
                canvas.style.pointerEvents = "none"
                canvas.style.zIndex = "100"
                document.body.appendChild(canvas)

                const myConfetti = confetti.create(canvas, {
                  resize: true,
                  useWorker: true,
                })

                myConfetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: ["#1E90FF", "#00BFFF", "#87CEFA", "#4169E1", "#6495ED", "#4682B4"],
                })

                setTimeout(() => {
                  document.body.removeChild(canvas)
                }, 3000)
              }, 300)
            } catch (error) {
              console.error("Failed to parse chart data:", error)
              console.error(
                "Raw chart data string:",
                content.includes("CHART_DATA:") ? content.split("CHART_DATA:")[1] : "No CHART_DATA found",
              )
            }
          } else {
            console.log("No chart data found in response")
          }

          newMessages[assistantMsgIndex] = {
            id: `assistant-${Date.now()}`,
            content: content,
            role: "assistant",
          }
        }

        return newMessages
      })
    } catch (error) {
      console.error("Error:", error)
      setMessages((prev) => {
        const newMessages = [...prev]
        const assistantMsgIndex = newMessages.findIndex((m) => m.id === "assistant-streaming")

        if (assistantMsgIndex >= 0) {
          newMessages[assistantMsgIndex] = {
            id: `assistant-error-${Date.now()}`,
            content: "Sorry, there was an error processing your request. Please try again.",
            role: "assistant",
          }
        } else {
          newMessages.push({
            id: `assistant-error-${Date.now()}`,
            content: "Sorry, there was an error processing your request. Please try again.",
            role: "assistant",
          })
        }

        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Function to manually trigger chart display for testing
  const triggerTestChart = () => {
    // Create more interesting test data with multiple metrics
    const testChartData = {
      type: "bar",
      title: "MediGraph Data",
      data: [
        { name: "Oxygen level (SpO2)", value: 96, target: 98, previous: 94 },
        { name: "Blood sugar (mg/dL)", value: 110, target: 100, previous: 125 },
        { name: "Blood pressure (mmHg)", value: 130, target: 120, previous: 140 },
        { name: "Heart rate (bpm)", value: 78, target: 72, previous: 85 },
        { name: "Body temperature (°F)", value: 98.6, target: 98.6, previous: 99.2 },
      ],
    }

    setChartData(testChartData)
    setActiveChart("bar")
    setShowChart(true)

    // Add a test message
    setMessages((prev) => [
      ...prev,
      {
        id: `test-${Date.now()}`,
        content:
          "Here's a MediGraph I've created for you! You can switch between different chart types to see the same data visualized in different ways.",
        role: "assistant",
      },
    ])

    // Trigger confetti effect for the MediGraph
    setTimeout(() => {
      const canvas = document.createElement("canvas")
      canvas.style.position = "fixed"
      canvas.style.inset = "0"
      canvas.style.width = "100vw"
      canvas.style.height = "100vh"
      canvas.style.pointerEvents = "none"
      canvas.style.zIndex = "100"
      document.body.appendChild(canvas)

      const myConfetti = confetti.create(canvas, {
        resize: true,
        useWorker: true,
      })

      myConfetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#1E90FF", "#00BFFF", "#87CEFA", "#4169E1", "#6495ED", "#4682B4"],
      })

      setTimeout(() => {
        document.body.removeChild(canvas)
      }, 3000)
    }, 300)
  }

  const handleChartTypeChange = (type) => {
    // Add animation when changing chart type
    setActiveChart("")
    setTimeout(() => {
      setActiveChart(type)
    }, 300)
  }

  const handlePieSectorEnter = (_, index) => {
    setActiveIndex(index)
  }

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 10}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 14}
          outerRadius={outerRadius + 18}
          fill={fill}
        />
        <text x={cx} y={cy} dy={-15} textAnchor="middle" fill={fill} className="text-lg font-semibold">
          {payload.name}
        </text>
        <text x={cx} y={cy} dy={15} textAnchor="middle" fill={fill}>
          {`${(percent * 100).toFixed(2)}%`}
        </text>
        <text x={cx} y={cy} dy={40} textAnchor="middle" fill={fill} className="text-sm">
          {`(Value: ${value})`}
        </text>
      </g>
    )
  }

  // Sample questions for quick prompts
  const sampleQuestions = [
    "Analyze my hydration levels over the past week",
    "Visualize my calorie burn from workouts this month",
    "Track my heart rate variations during workouts",
    "Show me my sleep quality trends",
    "Generate a chart of my medication adherence"
  ];
  
  
  const handleSampleQuestion = (question) => {
    setInput(question)
    // Focus on the input field
    document.getElementById("chat-input").focus()
  }

  const messageVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
      <motion.h1
  className="chatbot-title"
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  <span className="chatbot-title-icon">
    <img
      src="/visual.png"
      alt="Health Data Visualization"
      className="chatbot-title-img"
      width={36}
      height={36}
      style={{ verticalAlign: "middle", marginRight: "0.7rem" }}
    />
  </span>
  <span className="title-text">Health Data Visualization</span>
</motion.h1>
        <div className="header-actions">
          <button className="test-chart-button" onClick={triggerTestChart}>
            MediGraph
          </button>
          <Link href="/" className="back-to-home">
            Back to Home
          </Link>
        </div>
      </div>

      <div className="chatbot-main">
        <div className="chat-panel">
          <div className="messages-container">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div key={message.id} variants={messageVariants} initial="hidden" animate="visible" exit="exit">
                  <ChatMessage message={message} />
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            {messages.length > 0 && (
              <div className="sample-questions">
                <p className="sample-questions-label">
                  <span className="sparkle-mini">✨</span>
                  Try asking:
                </p>
                <div className="sample-buttons">
                  {sampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      className="sample-question-button"
                      onClick={() => handleSampleQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="input-form">
              <div className="input-container">
                <input
                  id="chat-input"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask about your health data..."
                  className="chat-input"
                  disabled={isLoading}
                />
                {isLoading && (
                  <div className="loading-indicator">
                    <motion.div
                      className="loading-dot"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.2 }}
                    />
                    <motion.div
                      className="loading-dot"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.3, delay: 0.1 }}
                    />
                    <motion.div
                      className="loading-dot"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.4, delay: 0.2 }}
                    />
                  </div>
                )}
              </div>
              <button type="submit" disabled={isLoading || !input.trim()} className="send-button">
                <span className="send-icon">➤</span>
                Send
              </button>
            </form>
          </div>
        </div>

        <ChartDisplay
          showChart={showChart}
          activeChart={activeChart}
          chartData={chartData}
          handleChartTypeChange={handleChartTypeChange}
          handlePieSectorEnter={handlePieSectorEnter}
          activeIndex={activeIndex}
          renderActiveShape={renderActiveShape}
          sampleQuestions={sampleQuestions}
          handleSampleQuestion={handleSampleQuestion}
        />
      </div>

      <canvas ref={canvasRef} className="confetti-canvas" />
    </div>
  )
}
