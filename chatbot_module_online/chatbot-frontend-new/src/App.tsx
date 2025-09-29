import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Send, Moon, Sun, FileText, ChevronDown, User, Bot, MessageSquare, FolderOpen, Plus, Check, X } from 'lucide-react';
import arogyaLogo from 'figma:asset/63ec9960b8d0d17dbf30f33ba32896931b4526c3.png';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { ScrollArea } from './components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/ui/collapsible';
import { Progress } from './components/ui/progress';

interface Patient {
  id: string;
  name: string;
  files: UploadedFile[];
  messages: Message[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  sources?: Source[];
}

interface Source {
  pdfName: string;
  chunkId: string;
  relevanceScore: number;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [patients, setPatients] = useState<Patient[]>([
    {
      id: 'PATIENT_001',
      name: 'Patient 001',
      files: [],
      messages: []
    }
  ]);
  const [activePatientId, setActivePatientId] = useState('PATIENT_001');
  const [newPatientId, setNewPatientId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [chatMessage, setChatMessage] = useState('');
  const [topK, setTopK] = useState('3');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const activePatient = patients.find(p => p.id === activePatientId);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activePatient?.messages]);

  const handleAddPatient = () => {
    if (newPatientId && !patients.find(p => p.id === newPatientId)) {
      const newPatient: Patient = {
        id: newPatientId,
        name: `Patient ${newPatientId}`,
        files: [],
        messages: []
      };
      setPatients([...patients, newPatient]);
      setActivePatientId(newPatientId);
      setNewPatientId('');
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFiles || !activePatient) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate file upload with progress
    const uploadPromises = Array.from(selectedFiles).map(async (file, index) => {
      return new Promise<UploadedFile>((resolve) => {
        setTimeout(() => {
          const uploadedFile: UploadedFile = {
            id: `file_${Date.now()}_${index}`,
            name: file.name,
            size: file.size,
            uploadedAt: new Date()
          };
          setUploadProgress((prev) => prev + (100 / selectedFiles.length));
          resolve(uploadedFile);
        }, 1000 + index * 500);
      });
    });

    const newFiles = await Promise.all(uploadPromises);
    
    setPatients(prevPatients => prevPatients.map(p => 
      p.id === activePatientId 
        ? { ...p, files: [...p.files, ...newFiles] }
        : p
    ));

    setIsUploading(false);
    setUploadProgress(0);
    setSelectedFiles(null);
    setShowSuccess(true);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Hide success message after 3 seconds
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !activePatient) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: chatMessage,
      timestamp: new Date()
    };

    setPatients(patients.map(p => 
      p.id === activePatientId 
        ? { ...p, messages: [...p.messages, userMessage] }
        : p
    ));

    setChatMessage('');
    setIsBotTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const botMessage: Message = {
        id: `msg_${Date.now()}_bot`,
        type: 'bot',
        content: `Based on the medical records uploaded for ${activePatient.name}, I can provide the following analysis: This appears to be a routine consultation query. The patient's symptoms suggest a common condition that can be managed with proper medication and lifestyle changes. I recommend consulting with a healthcare professional for proper diagnosis and treatment plan.`,
        timestamp: new Date(),
        sources: activePatient.files.length > 0 ? [
          { pdfName: activePatient.files[0]?.name || 'medical_record.pdf', chunkId: 'chunk_1', relevanceScore: 0.95 },
          { pdfName: activePatient.files[0]?.name || 'medical_record.pdf', chunkId: 'chunk_3', relevanceScore: 0.87 },
          { pdfName: activePatient.files[0]?.name || 'medical_record.pdf', chunkId: 'chunk_7', relevanceScore: 0.76 }
        ] : undefined
      };

      setPatients(prevPatients => prevPatients.map(p => 
        p.id === activePatientId 
          ? { ...p, messages: [...p.messages, botMessage] }
          : p
      ));
      setIsBotTyping(false);
    }, 2000);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const pdfFiles = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
      if (pdfFiles.length > 0) {
        const dt = new DataTransfer();
        pdfFiles.forEach(file => dt.items.add(file));
        setSelectedFiles(dt.files);
      }
    }
  };

  const PatientSelector = () => (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {patients.map((patient) => (
              <motion.button
                key={patient.id}
                onClick={() => setActivePatientId(patient.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  activePatientId === patient.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{patient.name}</span>
                  {patient.files.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-xs bg-green-100 text-green-800">
                      {patient.files.length}
                    </Badge>
                  )}
                  {patient.messages.filter(m => m.type === 'user').length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-xs bg-blue-100 text-blue-800">
                      {patient.messages.filter(m => m.type === 'user').length}
                    </Badge>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="e.g., PATIENT_002"
              value={newPatientId}
              onChange={(e) => setNewPatientId(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleAddPatient}
              disabled={!newPatientId || !!patients.find(p => p.id === newPatientId)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Patient
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg shadow-lg"
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <motion.div
              whileHover={{ rotate: 5 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center w-14 h-14 rounded-xl shadow-lg overflow-hidden"
            >
              <img 
                src={arogyaLogo} 
                alt="ArogyaLink Logo" 
                className="w-full h-full object-contain"
              />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                ArogyaLink
              </h1>
              <p className="text-sm text-muted-foreground">Rural Healthcare Assistant</p>
            </div>
          </motion.div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="border-2 hover:border-blue-300 dark:hover:border-blue-700"
          >
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.div>
          </Button>
        </div>
      </motion.header>

      <div className="container mx-auto px-4 py-6">
        {/* Success Toast */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className="fixed top-20 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span>Files uploaded successfully!</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuccess(false)}
                className="text-white hover:bg-green-600 h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-2">
              <TabsTrigger 
                value="upload" 
                className="relative data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white rounded-lg transition-all duration-300"
              >
                <motion.div 
                  className="flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                >
                  <FolderOpen className="w-5 h-5" />
                  <span>Upload Records</span>
                </motion.div>
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="relative data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-300"
              >
                <motion.div 
                  className="flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Medical Chat</span>
                </motion.div>
              </TabsTrigger>
            </TabsList>

            {/* Upload Tab */}
            <TabsContent value="upload" className="space-y-6">
              <PatientSelector />
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-2 border-green-200 dark:border-green-800">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-t-lg">
                    <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                      <Upload className="w-5 h-5" />
                      Upload Medical Records for {activePatient?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {/* File Upload Zone */}
                    <motion.div 
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                        dragActive 
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 scale-105' 
                          : 'border-green-300 dark:border-green-700 hover:border-green-400 dark:hover:border-green-600'
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      whileHover={{ scale: 1.02 }}
                    >
                      <motion.div
                        animate={dragActive ? { scale: 1.1, rotate: 5 } : {}}
                        transition={{ duration: 0.2 }}
                      >
                        <FileText className="w-16 h-16 mx-auto mb-4 text-green-500" />
                      </motion.div>
                      <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                        {dragActive ? 'Drop your files here!' : 'Upload Medical Documents'}
                      </h3>
                      <p className="text-green-600 dark:text-green-400 mb-6">
                        Drag & drop PDF files here, or click to select
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf"
                        onChange={(e) => setSelectedFiles(e.target.files)}
                        className="hidden"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/20"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Select PDF Files
                      </Button>
                    </motion.div>

                    {/* Selected Files */}
                    <AnimatePresence>
                      {selectedFiles && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="space-y-3"
                        >
                          <h4 className="font-medium text-green-800 dark:text-green-200">Selected Files:</h4>
                          {Array.from(selectedFiles).map((file, index) => (
                            <motion.div 
                              key={`${file.name}-${index}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                            >
                              <FileText className="w-5 h-5 text-green-600" />
                              <span className="flex-1 text-sm truncate">{file.name}</span>
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                                {(file.size / 1024 / 1024).toFixed(1)}MB
                              </Badge>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Upload Progress */}
                    <AnimatePresence>
                      {isUploading && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="space-y-3"
                        >
                          <Progress 
                            value={uploadProgress} 
                            className="h-3 bg-green-100 dark:bg-green-900"
                          />
                          <p className="text-center text-green-700 dark:text-green-300">
                            <motion.span
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              Uploading... {Math.round(uploadProgress)}%
                            </motion.span>
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Upload Button */}
                    <Button 
                      onClick={handleFileUpload}
                      disabled={!selectedFiles || isUploading}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 text-lg"
                    >
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2"
                      >
                        <Upload className="w-5 h-5" />
                        {isUploading ? 'Uploading...' : 'Upload Medical Records'}
                      </motion.div>
                    </Button>

                    {/* Uploaded Files List */}
                    {activePatient && activePatient.files.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-3"
                      >
                        <h4 className="font-medium text-green-800 dark:text-green-200">
                          Uploaded Files ({activePatient.files.length}):
                        </h4>
                        <ScrollArea className="h-48 bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-200 dark:border-green-800">
                          {activePatient.files.map((file, index) => (
                            <motion.div
                              key={file.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="flex items-center gap-3 p-2 mb-2 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                              <FileText className="w-4 h-4 text-green-600" />
                              <div className="flex-1">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {file.uploadedAt.toLocaleDateString()} • {(file.size / 1024 / 1024).toFixed(1)}MB
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </ScrollArea>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="space-y-6">
              <PatientSelector />
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="h-[600px] flex flex-col border-2 border-blue-200 dark:border-blue-800">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-t-lg">
                    <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <Bot className="w-5 h-5" />
                      Medical Chat Assistant - {activePatient?.name}
                    </CardTitle>
                  </CardHeader>
                  
                  {/* Chat Messages */}
                  <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
                    <AnimatePresence>
                      {activePatient?.messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 20, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -20, scale: 0.9 }}
                          className={`mb-4 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-xl p-4 shadow-lg ${
                            message.type === 'user' 
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white ml-12' 
                              : 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 mr-12 border border-gray-200 dark:border-gray-600'
                          }`}>
                            <div className="flex items-start gap-3 mb-2">
                              <div className={`p-2 rounded-full ${
                                message.type === 'user' 
                                  ? 'bg-white/20' 
                                  : 'bg-blue-500'
                              }`}>
                                {message.type === 'user' ? (
                                  <User className="w-4 h-4" />
                                ) : (
                                  <Bot className="w-4 h-4 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="leading-relaxed">{message.content}</p>
                                <p className={`text-xs mt-2 ${
                                  message.type === 'user' 
                                    ? 'text-white/70' 
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  {message.timestamp.toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            
                            {/* Sources */}
                            {message.sources && message.sources.length > 0 && (
                              <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-2 text-sm hover:underline bg-white/10 rounded-lg p-2 w-full">
                                  <span>Sources ({message.sources.length})</span>
                                  <ChevronDown className="w-3 h-3" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 space-y-2">
                                  {message.sources.map((source, index) => (
                                    <motion.div 
                                      key={`${source.chunkId}-${index}`}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: index * 0.1 }}
                                      className="text-sm p-3 bg-white/10 rounded-lg border border-white/20"
                                    >
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="font-medium">{source.pdfName}</span>
                                        <Badge variant="outline" className="h-5 text-xs bg-green-100 text-green-800 border-green-300">
                                          {(source.relevanceScore * 100).toFixed(0)}%
                                        </Badge>
                                      </div>
                                      <p className="text-xs opacity-70">Chunk: {source.chunkId}</p>
                                    </motion.div>
                                  ))}
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    {/* Typing Indicator */}
                    <AnimatePresence>
                      {isBotTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex justify-start mb-4"
                        >
                          <div className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl p-4 mr-12 shadow-lg">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-blue-500">
                                <Bot className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex space-x-2">
                                <motion.div
                                  animate={{ opacity: [0, 1, 0] }}
                                  transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                                  className="w-2 h-2 bg-blue-500 rounded-full"
                                />
                                <motion.div
                                  animate={{ opacity: [0, 1, 0] }}
                                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                                  className="w-2 h-2 bg-blue-500 rounded-full"
                                />
                                <motion.div
                                  animate={{ opacity: [0, 1, 0] }}
                                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                                  className="w-2 h-2 bg-blue-500 rounded-full"
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </ScrollArea>
                  
                  {/* Chat Input */}
                  <div className="p-4 border-t bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-b-lg space-y-3">
                    <div className="flex gap-2">
                      <Select value={topK} onValueChange={setTopK}>
                        <SelectTrigger className="w-32 border-blue-200 dark:border-blue-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map(num => (
                            <SelectItem key={num} value={num.toString()}>
                              Top {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex gap-3">
                      <Textarea
                        placeholder="Ask a medical question..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="flex-1 min-h-[60px] resize-none border-blue-200 dark:border-blue-700 focus:border-blue-400 dark:focus:border-blue-500"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!chatMessage.trim() || isBotTyping}
                        size="icon"
                        className="self-end h-[60px] w-[60px] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                      >
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 45 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Send className="w-5 h-5" />
                        </motion.div>
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}