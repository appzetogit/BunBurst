import { useState, useEffect, useRef } from "react"
import { Search, Info, Settings, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/api/axios"
import { API_ENDPOINTS } from "@/lib/api/config"

export default function Chattings() {
  const [activeTab, setActiveTab] = useState("customer")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchConversations()
  }, [activeTab])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation._id)
    }
  }, [selectedConversation])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchConversations = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(API_ENDPOINTS.CHAT.CONVERSATIONS, {
        params: { type: activeTab }
      })
      if (response.data.success) {
        setConversations(response.data.data.conversations || [])
      }
    } catch (error) {
      console.error("Error fetching conversations:", error)
      toast.error("Failed to load conversations")
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (conversationId) => {
    try {
      setMessagesLoading(true)
      const response = await apiClient.get(
        API_ENDPOINTS.CHAT.MESSAGES.replace(":id", conversationId)
      )
      if (response.data.success) {
        setMessages(response.data.data.messages || [])
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
      toast.error("Failed to load messages")
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return

    try {
      const response = await apiClient.post(
        API_ENDPOINTS.CHAT.MESSAGES.replace(":id", selectedConversation._id),
        { text: newMessage }
      )
      if (response.data.success) {
        setMessages([...messages, response.data.data.message])
        setNewMessage("")
        // Update last message in conversation list
        setConversations(conversations.map(conv =>
          conv._id === selectedConversation._id
            ? { ...conv, lastMessage: newMessage, lastMessageAt: new Date().toISOString() }
            : conv
        ))
      }
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
    }
  }

  const filteredConversations = conversations.filter(conv => {
    const participant = activeTab === "customer" ? conv.user : conv.restaurant
    if (!participant) return false

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      return (
        participant.name?.toLowerCase().includes(query) ||
        participant.phone?.includes(query) ||
        participant.email?.toLowerCase().includes(query)
      )
    }

    return true
  })

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString()
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-[calc(100vh-8rem)]">
            {/* Left Panel - Conversation List */}
            <div className="border-r border-slate-200 flex flex-col">
              <div className="p-6 border-b border-slate-200">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">Conversation List</h1>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search by name, phone or email"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200">
                  <button
                    onClick={() => {
                      setActiveTab("customer")
                      setSelectedConversation(null)
                    }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "customer"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Customer
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("restaurant")
                      setSelectedConversation(null)
                    }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "restaurant"
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Cafe
                  </button>
                </div>
              </div>

              {/* Conversation List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-6">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <Info className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No conversations found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredConversations.map((conversation) => {
                      const participant = activeTab === "customer" ? conversation.user : conversation.restaurant
                      if (!participant) return null

                      return (
                        <button
                          key={conversation._id}
                          onClick={() => setSelectedConversation(conversation)}
                          className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${selectedConversation?._id === conversation._id ? "bg-blue-50" : ""
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden text-lg">
                              {participant.profileImage || participant.avatar || participant.logo ? (
                                <img
                                  src={participant.profileImage || participant.avatar || participant.logo}
                                  alt={participant.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>👤</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-sm font-semibold text-slate-900 truncate">
                                  {participant.name}
                                </h3>
                                <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                                  {formatTimestamp(conversation.lastMessageAt)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 truncate mb-1">
                                {participant.phone || participant.email}
                              </p>
                              <p className="text-sm text-slate-600 truncate">
                                {conversation.lastMessage}
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Conversation View */}
            <div className="flex flex-col relative">
              {selectedConversation ? (
                <>
                  {/* Conversation Header */}
                  <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const participant = activeTab === "customer" ? selectedConversation.user : selectedConversation.restaurant
                        return (
                          <>
                            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden text-lg">
                              {participant?.profileImage || participant?.avatar || participant?.logo ? (
                                <img
                                  src={participant.profileImage || participant.avatar || participant.logo}
                                  alt={participant.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>👤</span>
                              )}
                            </div>
                            <div>
                              <h2 className="text-lg font-semibold text-slate-900">{participant?.name}</h2>
                              <p className="text-sm text-slate-500">{participant?.phone || participant?.email}</p>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg, idx) => {
                          const isMe = msg.sender.senderType === "Admin"
                          return (
                            <div key={msg._id || idx} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm ${isMe
                                ? "bg-blue-600 text-white rounded-tr-none"
                                : "bg-white text-slate-900 rounded-tl-none border border-slate-200"
                                }`}>
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                                <p className={`text-[10px] mt-1 ${isMe ? "text-blue-100" : "text-slate-500"}`}>
                                  {formatTimestamp(msg.createdAt)}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Message Input */}
                  <div className="p-6 border-t border-slate-200 bg-white">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-slate-50/30">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <Info className="w-12 h-12 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">Please select a user to view the conversation.</p>
                  </div>
                </div>
              )}

              {/* Settings Icon */}
              <button className="absolute top-6 right-6 p-2 rounded-lg bg-white shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors">
                <Settings className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
