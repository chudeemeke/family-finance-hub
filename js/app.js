/**
 * Main App Component
 * Family Finance Hub v2.0
 * 
 * This is the main entry point that ties everything together
 */

// React hooks
const { useState, useEffect, useContext, createContext, useCallback, useMemo, useRef } = React;

// =====================================================
// DEFAULT DATA & CONSTANTS
// =====================================================

const STORAGE_PREFIX = 'ffh_';
const APP_VERSION = '2.0.0';

function getDefaultCategories() {
    return {
        income: [
            { id: 'salary', name: 'Salary', icon: '💰', color: '#10b981' },
            { id: 'freelance', name: 'Freelance', icon: '💻', color: '#06b6d4' },
            { id: 'investment', name: 'Investment', icon: '📈', color: '#6366f1' },
            { id: 'gift', name: 'Gift', icon: '🎁', color: '#f59e0b' },
            { id: 'refund', name: 'Refund', icon: '↩️', color: '#8b5cf6' },
            { id: 'other_income', name: 'Other', icon: '📥', color: '#6b7280' }
        ],
        expense: [
            { id: 'food', name: 'Food & Dining', icon: '🍔', color: '#ef4444' },
            { id: 'transport', name: 'Transport', icon: '🚗', color: '#3b82f6' },
            { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#ec4899' },
            { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#f59e0b' },
            { id: 'bills', name: 'Bills & Utilities', icon: '📄', color: '#14b8a6' },
            { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#06b6d4' },
            { id: 'education', name: 'Education', icon: '📚', color: '#8b5cf6' },
            { id: 'home', name: 'Home', icon: '🏠', color: '#10b981' },
            { id: 'other_expense', name: 'Other', icon: '📤', color: '#6b7280' }
        ]
    };
}

// =====================================================
// APP CONTEXT
// =====================================================

const AppContext = createContext();

function AppProvider({ children }) {
    // Core State
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [familyConfig, setFamilyConfig] = useState({
        familyCode: null,
        familyName: 'Our Family',
        memberCode: null,
        memberName: null,
        encryptionKey: null,
        syncEnabled: true,
        gistId: null,
        members: []
    });
    
    // Navigation State
    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeView, setActiveView] = useState('overview');
    
    // Financial Data State
    const [transactions, setTransactions] = useState([]);
    const [budget, setBudget] = useState({});
    const [savingsGoals, setSavingsGoals] = useState([]);
    const [categories] = useState(getDefaultCategories());
    const [billReminders, setBillReminders] = useState([]);
    const [accounts, setAccounts] = useState([]);
    
    // UI State
    const [loading, setLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState('idle');
    const [theme, setTheme] = useState('system');
    const [showAddTransaction, setShowAddTransaction] = useState(false);
    
    // Initialize app on mount
    useEffect(() => {
        initializeApp();
    }, []);
    
    const initializeApp = async () => {
        setLoading(true);
        
        try {
            // Initialize IndexedDB
            await window.dbManager.init();
            console.log('IndexedDB initialized');
            
            // Check authentication
            const savedAuth = localStorage.getItem(`${STORAGE_PREFIX}auth`);
            if (savedAuth) {
                const authData = JSON.parse(savedAuth);
                if (authData.expiresAt > Date.now()) {
                    setIsLoggedIn(true);
                    setCurrentUser(authData.user);
                    setFamilyConfig(authData.familyConfig || {});
                    
                    // Initialize sync
                    if (authData.familyConfig?.gistId) {
                        window.enhancedSyncManager.init(
                            authData.familyConfig.familyCode,
                            authData.familyConfig.memberCode,
                            authData.familyConfig.gistId
                        );
                    }
                    
                    // Load saved data
                    await loadSavedData();
                }
            }
            
            // Apply theme
            applyTheme(theme);
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const loadSavedData = async () => {
        try {
            const [
                savedTransactions,
                savedAccounts,
                savedBillReminders,
                savedSavingsGoals
            ] = await Promise.all([
                window.dbManager.getAll('transactions'),
                window.dbManager.getAll('accounts'),
                window.dbManager.getAll('billReminders'),
                window.dbManager.getAll('savingsGoals')
            ]);
            
            if (savedTransactions.length) setTransactions(savedTransactions);
            if (savedAccounts.length) setAccounts(savedAccounts);
            if (savedBillReminders.length) setBillReminders(savedBillReminders);
            if (savedSavingsGoals.length) setSavingsGoals(savedSavingsGoals);
            
        } catch (error) {
            console.error('Failed to load saved data:', error);
        }
    };
    
    const applyTheme = (themeMode) => {
        let isDark = false;
        
        if (themeMode === 'system') {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
            isDark = themeMode === 'dark';
        }
        
        document.documentElement.classList.toggle('dark', isDark);
    };
    
    const showNotification = (message, type = 'info') => {
        if (window.notificationManager) {
            window.notificationManager.add(message, type);
        }
    };
    
    const addTransaction = async (transaction) => {
        const newTransaction = {
            ...transaction,
            id: window.SecurityManager.generateUUID(),
            createdAt: new Date().toISOString(),
            memberCode: familyConfig.memberCode
        };
        
        setTransactions(prev => [newTransaction, ...prev]);
        
        // Save to IndexedDB
        await window.dbManager.save('transactions', newTransaction);
        
        // Queue for sync
        if (familyConfig.syncEnabled) {
            window.enhancedSyncManager.queueOperation({
                type: 'CREATE',
                entity: 'transactions',
                data: newTransaction
            });
        }
        
        showNotification('Transaction added successfully!', 'success');
    };
    
    // Calculate statistics
    const statistics = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const monthlyTransactions = transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === currentMonth && 
                   date.getFullYear() === currentYear;
        });
        
        const income = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        const expenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + (t.amount || 0), 0);
        
        const balance = income - expenses;
        
        const categoryBreakdown = {};
        monthlyTransactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
                categoryBreakdown[t.category] = 
                    (categoryBreakdown[t.category] || 0) + (t.amount || 0);
            });
        
        const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        const totalSavings = savingsGoals.reduce((sum, goal) => sum + (goal.current || 0), 0);
        
        return {
            monthlyIncome: income,
            monthlyExpenses: expenses,
            monthlyBalance: balance,
            categoryBreakdown,
            totalBalance,
            totalSavings,
            netWorth: totalBalance + totalSavings
        };
    }, [transactions, accounts, savingsGoals]);
    
    const contextValue = {
        // State
        isLoggedIn,
        currentUser,
        familyConfig,
        activeTab,
        activeView,
        transactions,
        budget,
        savingsGoals,
        categories,
        billReminders,
        accounts,
        loading,
        syncStatus,
        theme,
        showAddTransaction,
        
        // Computed
        statistics,
        
        // Methods
        setIsLoggedIn,
        setCurrentUser,
        setFamilyConfig,
        setActiveTab,
        setActiveView,
        setTransactions,
        setBudget,
        setSavingsGoals,
        setBillReminders,
        setAccounts,
        setLoading,
        setSyncStatus,
        setTheme,
        setShowAddTransaction,
        showNotification,
        addTransaction,
        applyTheme,
        loadSavedData
    };
    
    // Make context available globally
    useEffect(() => {
        window.appContext = contextValue;
    }, [contextValue]);
    
    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

// =====================================================
// LOGIN COMPONENT
// =====================================================

function LoginScreen() {
    const context = useContext(AppContext);
    const [step, setStep] = useState('welcome'); // welcome, setup, join
    const [familyCode, setFamilyCode] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [memberName, setMemberName] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    
    const handleSetup = async (e) => {
        e.preventDefault();
        setError('');
        
        // Validate inputs
        if (!familyName || !memberName || !pin) {
            setError('Please fill in all fields');
            return;
        }
        
        const pinValidation = window.SecurityManager.validatePin(pin);
        if (!pinValidation.valid) {
            setError(pinValidation.message);
            return;
        }
        
        // Generate family code
        const generatedFamilyCode = window.SecurityManager.generateRandomString(8).toUpperCase();
        const memberCode = window.SecurityManager.generateUUID();
        const encryptionKey = window.SecurityManager.generateFamilyKey(generatedFamilyCode, pin);
        
        // Set up family config
        const config = {
            familyCode: generatedFamilyCode,
            familyName,
            memberCode,
            memberName,
            encryptionKey,
            syncEnabled: true,
            gistId: null,
            members: [{
                code: memberCode,
                name: memberName,
                role: 'admin',
                joinedAt: new Date().toISOString()
            }]
        };
        
        // Save auth data
        const authData = {
            user: { id: memberCode, name: memberName },
            familyConfig: config,
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
        };
        
        localStorage.setItem(`${STORAGE_PREFIX}auth`, JSON.stringify(authData));
        
        // Update context
        context.setCurrentUser(authData.user);
        context.setFamilyConfig(config);
        context.setIsLoggedIn(true);
        
        // Initialize sync
        window.enhancedSyncManager.init(generatedFamilyCode, memberCode);
        
        // Show success message
        context.showNotification(`Welcome ${memberName}! Your family code is: ${generatedFamilyCode}`, 'success');
    };
    
    const handleJoin = async (e) => {
        e.preventDefault();
        setError('');
        
        // Validate inputs
        if (!familyCode || !memberName || !pin) {
            setError('Please fill in all fields');
            return;
        }
        
        const memberCode = window.SecurityManager.generateUUID();
        const encryptionKey = window.SecurityManager.generateFamilyKey(familyCode.toUpperCase(), pin);
        
        // Set up family config
        const config = {
            familyCode: familyCode.toUpperCase(),
            familyName: 'Family', // Will be updated from sync
            memberCode,
            memberName,
            encryptionKey,
            syncEnabled: true,
            gistId: null,
            members: []
        };
        
        // Save auth data
        const authData = {
            user: { id: memberCode, name: memberName },
            familyConfig: config,
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
        };
        
        localStorage.setItem(`${STORAGE_PREFIX}auth`, JSON.stringify(authData));
        
        // Update context
        context.setCurrentUser(authData.user);
        context.setFamilyConfig(config);
        context.setIsLoggedIn(true);
        
        // Initialize sync
        window.enhancedSyncManager.init(familyCode.toUpperCase(), memberCode);
        
        // Show success message
        context.showNotification(`Welcome ${memberName}!`, 'success');
    };
    
    if (step === 'welcome') {
        return (
            <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full fade-in">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                            Family Finance Hub
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Manage your family's finances together
                        </p>
                    </div>
                    
                    <div className="space-y-4">
                        <button
                            onClick={() => setStep('setup')}
                            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition duration-200"
                        >
                            Create New Family
                        </button>
                        
                        <button
                            onClick={() => setStep('join')}
                            className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                        >
                            Join Existing Family
                        </button>
                    </div>
                    
                    <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        <p>Version {APP_VERSION}</p>
                        <p className="mt-2">Your data is encrypted and stored locally</p>
                    </div>
                </div>
            </div>
        );
    }
    
    if (step === 'setup') {
        return (
            <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full slide-in">
                    <button
                        onClick={() => setStep('welcome')}
                        className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                        ← Back
                    </button>
                    
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                        Create New Family
                    </h2>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleSetup} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Family Name
                            </label>
                            <input
                                type="text"
                                value={familyName}
                                onChange={(e) => setFamilyName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                placeholder="The Smiths"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Your Name
                            </label>
                            <input
                                type="text"
                                value={memberName}
                                onChange={(e) => setMemberName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                placeholder="John"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Family PIN (4-8 digits)
                            </label>
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                placeholder="••••"
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                This PIN will be shared with family members
                            </p>
                        </div>
                        
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition duration-200"
                        >
                            Create Family
                        </button>
                    </form>
                </div>
            </div>
        );
    }
    
    if (step === 'join') {
        return (
            <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full slide-in">
                    <button
                        onClick={() => setStep('welcome')}
                        className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                        ← Back
                    </button>
                    
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                        Join Existing Family
                    </h2>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleJoin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Family Code
                            </label>
                            <input
                                type="text"
                                value={familyCode}
                                onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white font-mono"
                                placeholder="ABC12345"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Your Name
                            </label>
                            <input
                                type="text"
                                value={memberName}
                                onChange={(e) => setMemberName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                placeholder="Jane"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Family PIN
                            </label>
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                placeholder="••••"
                                required
                            />
                        </div>
                        
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition duration-200"
                        >
                            Join Family
                        </button>
                    </form>
                </div>
            </div>
        );
    }
}

// =====================================================
// MAIN APP COMPONENT
// =====================================================

function MainApp() {
    const context = useContext(AppContext);
    const { activeTab, showAddTransaction } = context;
    
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm safe-top">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {context.familyConfig.familyName}
                            </h1>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {context.currentUser?.name}
                            </span>
                            
                            {context.syncStatus === 'syncing' && (
                                <div className="spinner w-4 h-4"></div>
                            )}
                            
                            <button
                                onClick={() => {
                                    localStorage.removeItem(`${STORAGE_PREFIX}auth`);
                                    context.setIsLoggedIn(false);
                                }}
                                className="text-sm text-red-600 hover:text-red-700"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            
            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'dashboard' && <DashboardView />}
                {activeTab === 'transactions' && <TransactionsView />}
                {activeTab === 'budget' && <BudgetView />}
                {activeTab === 'savings' && <SavingsView />}
                {activeTab === 'settings' && <SettingsView />}
            </main>
            
            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-lg safe-bottom">
                <div className="flex justify-around">
                    {[
                        { id: 'dashboard', icon: '🏠', label: 'Home' },
                        { id: 'transactions', icon: '💸', label: 'Transactions' },
                        { id: 'budget', icon: '📊', label: 'Budget' },
                        { id: 'savings', icon: '🎯', label: 'Savings' },
                        { id: 'settings', icon: '⚙️', label: 'Settings' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => context.setActiveTab(tab.id)}
                            className={`flex-1 py-2 px-2 flex flex-col items-center ${
                                activeTab === tab.id
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                            <span className="text-xl">{tab.icon}</span>
                            <span className="text-xs mt-1">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
            
            {/* Floating Action Button */}
            <button
                onClick={() => context.setShowAddTransaction(true)}
                className="fab"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </button>
            
            {/* Add Transaction Modal */}
            {showAddTransaction && <AddTransactionModal />}
        </div>
    );
}

// =====================================================
// DASHBOARD VIEW
// =====================================================

function DashboardView() {
    const context = useContext(AppContext);
    const { statistics, transactions } = context;
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };
    
    const recentTransactions = transactions.slice(0, 5);
    
    return (
        <div className="space-y-6 pb-20">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Monthly Income
                    </h3>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                        {formatCurrency(statistics.monthlyIncome)}
                    </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Monthly Expenses
                    </h3>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                        {formatCurrency(statistics.monthlyExpenses)}
                    </p>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Net Worth
                    </h3>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                        {formatCurrency(statistics.netWorth)}
                    </p>
                </div>
            </div>
            
            {/* Recent Transactions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Recent Transactions
                </h2>
                
                {recentTransactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No transactions yet</p>
                        <button
                            onClick={() => context.setShowAddTransaction(true)}
                            className="mt-4 text-indigo-600 hover:text-indigo-700"
                        >
                            Add your first transaction
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentTransactions.map(transaction => (
                            <div
                                key={transaction.id}
                                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">
                                        {context.categories[transaction.type]
                                            ?.find(c => c.id === transaction.category)?.icon || '💰'}
                                    </span>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {transaction.description}
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(transaction.date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <p className={`font-semibold ${
                                    transaction.type === 'income' 
                                        ? 'text-green-600 dark:text-green-400' 
                                        : 'text-red-600 dark:text-red-400'
                                }`}>
                                    {transaction.type === 'income' ? '+' : '-'}
                                    {formatCurrency(transaction.amount)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
                
                {transactions.length > 5 && (
                    <button
                        onClick={() => context.setActiveTab('transactions')}
                        className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm"
                    >
                        View all transactions →
                    </button>
                )}
            </div>
        </div>
    );
}

// =====================================================
// TRANSACTIONS VIEW
// =====================================================

function TransactionsView() {
    const context = useContext(AppContext);
    const { transactions, categories } = context;
    const [filter, setFilter] = useState('all'); // all, income, expense
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };
    
    const filteredTransactions = transactions.filter(t => {
        if (filter === 'all') return true;
        return t.type === filter;
    });
    
    const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
        const date = new Date(transaction.date).toDateString();
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(transaction);
        return groups;
    }, {});
    
    return (
        <div className="space-y-4 pb-20">
            {/* Filter Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-2 flex">
                {['all', 'income', 'expense'].map(type => (
                    <button
                        key={type}
                        onClick={() => setFilter(type)}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                            filter === type
                                ? 'bg-indigo-600 text-white'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                ))}
            </div>
            
            {/* Transactions List */}
            {Object.entries(groupedTransactions).length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                        No transactions found
                    </p>
                </div>
            ) : (
                Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
                    <div key={date} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                            {date === new Date().toDateString() ? 'Today' : date}
                        </h3>
                        
                        <div className="space-y-3">
                            {dayTransactions.map(transaction => (
                                <div
                                    key={transaction.id}
                                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors transaction-item"
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl">
                                            {categories[transaction.type]
                                                ?.find(c => c.id === transaction.category)?.icon || '💰'}
                                        </span>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {transaction.description}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {categories[transaction.type]
                                                    ?.find(c => c.id === transaction.category)?.name || 'Other'}
                                            </p>
                                        </div>
                                    </div>
                                    <p className={`font-semibold ${
                                        transaction.type === 'income' 
                                            ? 'text-green-600 dark:text-green-400' 
                                            : 'text-red-600 dark:text-red-400'
                                    }`}>
                                        {transaction.type === 'income' ? '+' : '-'}
                                        {formatCurrency(transaction.amount)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

// =====================================================
// ADD TRANSACTION MODAL
// =====================================================

function AddTransactionModal() {
    const context = useContext(AppContext);
    const [type, setType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!amount || !description || !category) {
            context.showNotification('Please fill in all fields', 'error');
            return;
        }
        
        await context.addTransaction({
            type,
            amount: parseFloat(amount),
            description,
            category,
            date
        });
        
        context.setShowAddTransaction(false);
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full slide-up">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Add Transaction
                    </h2>
                    <button
                        onClick={() => context.setShowAddTransaction(false)}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type Toggle */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                            type="button"
                            onClick={() => setType('expense')}
                            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                                type === 'expense'
                                    ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            Expense
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('income')}
                            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                                type === 'income'
                                    ? 'bg-white dark:bg-gray-600 text-green-600 dark:text-green-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            Income
                        </button>
                    </div>
                    
                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Amount
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                            placeholder="0.00"
                            required
                        />
                    </div>
                    
                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                            placeholder="Coffee at Starbucks"
                            required
                        />
                    </div>
                    
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Category
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {context.categories[type].map(cat => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.id)}
                                    className={`p-3 rounded-lg border-2 transition-colors ${
                                        category === cat.id
                                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900'
                                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                    }`}
                                >
                                    <span className="text-2xl">{cat.icon}</span>
                                    <p className="text-xs mt-1">{cat.name}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Date
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                            required
                        />
                    </div>
                    
                    {/* Actions */}
                    <div className="flex space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={() => context.setShowAddTransaction(false)}
                            className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Add Transaction
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// =====================================================
// BUDGET VIEW
// =====================================================

function BudgetView() {
    const context = useContext(AppContext);
    const { budget, setBudget, statistics, categories } = context;
    const [isEditing, setIsEditing] = useState(false);
    const [editBudget, setEditBudget] = useState({});
    
    useEffect(() => {
        setEditBudget(budget);
    }, [budget]);
    
    const handleSave = async () => {
        setBudget(editBudget);
        setIsEditing(false);
        
        // Save to IndexedDB
        const budgetItems = Object.entries(editBudget).map(([category, amount]) => ({
            id: category,
            category,
            amount
        }));
        
        for (const item of budgetItems) {
            await window.dbManager.save('budgets', item);
        }
        
        context.showNotification('Budget updated successfully!', 'success');
    };
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };
    
    const totalBudget = Object.values(budget).reduce((sum, amount) => sum + (amount || 0), 0);
    
    return (
        <div className="space-y-4 pb-20">
            {/* Budget Overview */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Monthly Budget
                    </h2>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-indigo-600 hover:text-indigo-700"
                    >
                        {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                </div>
                
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Total Budget</span>
                        <span className="font-medium">{formatCurrency(totalBudget)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Spent</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                            {formatCurrency(statistics.monthlyExpenses)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Remaining</span>
                        <span className={`font-medium ${
                            totalBudget - statistics.monthlyExpenses >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                        }`}>
                            {formatCurrency(totalBudget - statistics.monthlyExpenses)}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Category Budgets */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Category Budgets
                </h3>
                
                <div className="space-y-4">
                    {categories.expense.map(category => {
                        const budgetAmount = isEditing ? editBudget[category.id] || 0 : budget[category.id] || 0;
                        const spentAmount = statistics.categoryBreakdown[category.id] || 0;
                        const percentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
                        
                        return (
                            <div key={category.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xl">{category.icon}</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {category.name}
                                        </span>
                                    </div>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={editBudget[category.id] || ''}
                                            onChange={(e) => setEditBudget({
                                                ...editBudget,
                                                [category.id]: parseFloat(e.target.value) || 0
                                            })}
                                            className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white text-right"
                                            placeholder="0"
                                        />
                                    ) : (
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {formatCurrency(spentAmount)} / {formatCurrency(budgetAmount)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                
                                {!isEditing && budgetAmount > 0 && (
                                    <div className="budget-progress">
                                        <div
                                            className={`budget-progress-bar ${
                                                percentage > 100 ? 'danger' : percentage > 80 ? 'warning' : ''
                                            }`}
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {isEditing && (
                    <button
                        onClick={handleSave}
                        className="mt-6 w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Save Budget
                    </button>
                )}
            </div>
        </div>
    );
}

// =====================================================
// SAVINGS VIEW
// =====================================================

function SavingsView() {
    const context = useContext(AppContext);
    const { savingsGoals, setSavingsGoals } = context;
    const [showAddGoal, setShowAddGoal] = useState(false);
    const [goalName, setGoalName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [targetDate, setTargetDate] = useState('');
    
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };
    
    const handleAddGoal = async (e) => {
        e.preventDefault();
        
        const newGoal = {
            id: window.SecurityManager.generateUUID(),
            name: goalName,
            targetAmount: parseFloat(targetAmount),
            current: 0,
            targetDate,
            createdAt: new Date().toISOString()
        };
        
        setSavingsGoals([...savingsGoals, newGoal]);
        
        // Save to IndexedDB
        await window.dbManager.save('savingsGoals', newGoal);
        
        // Reset form
        setGoalName('');
        setTargetAmount('');
        setTargetDate('');
        setShowAddGoal(false);
        
        context.showNotification('Savings goal added!', 'success');
    };
    
    const updateGoalProgress = async (goalId, amount) => {
        const updatedGoals = savingsGoals.map(goal => {
            if (goal.id === goalId) {
                return { ...goal, current: goal.current + amount };
            }
            return goal;
        });
        
        setSavingsGoals(updatedGoals);
        
        // Update in IndexedDB
        const goal = updatedGoals.find(g => g.id === goalId);
        await window.dbManager.save('savingsGoals', goal);
        
        context.showNotification('Progress updated!', 'success');
    };
    
    return (
        <div className="space-y-4 pb-20">
            {/* Add Goal Button */}
            <button
                onClick={() => setShowAddGoal(!showAddGoal)}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
            >
                {showAddGoal ? 'Cancel' : 'Add Savings Goal'}
            </button>
            
            {/* Add Goal Form */}
            {showAddGoal && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 slide-in">
                    <form onSubmit={handleAddGoal} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Goal Name
                            </label>
                            <input
                                type="text"
                                value={goalName}
                                onChange={(e) => setGoalName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                placeholder="Vacation Fund"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Target Amount
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={targetAmount}
                                onChange={(e) => setTargetAmount(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                placeholder="5000"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Target Date
                            </label>
                            <input
                                type="date"
                                value={targetDate}
                                onChange={(e) => setTargetDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                                required
                            />
                        </div>
                        
                        <button
                            type="submit"
                            className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
                        >
                            Create Goal
                        </button>
                    </form>
                </div>
            )}
            
            {/* Savings Goals */}
            {savingsGoals.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                        No savings goals yet
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                        Start by creating your first savings goal
                    </p>
                </div>
            ) : (
                savingsGoals.map(goal => {
                    const percentage = (goal.current / goal.targetAmount) * 100;
                    const daysLeft = Math.ceil((new Date(goal.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
                    
                    return (
                        <div key={goal.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {goal.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {daysLeft > 0 ? `${daysLeft} days left` : 'Past due'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        const amount = prompt('Add amount to savings:');
                                        if (amount && !isNaN(amount)) {
                                            updateGoalProgress(goal.id, parseFloat(amount));
                                        }
                                    }}
                                    className="text-green-600 hover:text-green-700"
                                >
                                    + Add
                                </button>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Progress</span>
                                    <span className="font-medium">
                                        {formatCurrency(goal.current)} / {formatCurrency(goal.targetAmount)}
                                    </span>
                                </div>
                                
                                <div className="budget-progress">
                                    <div
                                        className="budget-progress-bar"
                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                </div>
                                
                                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                                    {percentage.toFixed(1)}% Complete
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}

// =====================================================
// SETTINGS VIEW
// =====================================================

function SettingsView() {
    const context = useContext(AppContext);
    const { familyConfig, theme, setTheme } = context;
    
    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        context.applyTheme(newTheme);
        localStorage.setItem(`${STORAGE_PREFIX}theme`, newTheme);
    };
    
    const handleExportData = async () => {
        const data = await window.dbManager.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `family-finance-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        context.showNotification('Data exported successfully!', 'success');
    };
    
    return (
        <div className="space-y-4 pb-20">
            {/* Family Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Family Information
                </h2>
                
                <div className="space-y-3">
                    <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Family Code</label>
                        <p className="font-mono text-lg">{familyConfig.familyCode}</p>
                    </div>
                    <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Your Name</label>
                        <p className="text-lg">{context.currentUser?.name}</p>
                    </div>
                </div>
                
                <button
                    onClick={() => {
                        navigator.clipboard.writeText(familyConfig.familyCode);
                        context.showNotification('Family code copied!', 'success');
                    }}
                    className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm"
                >
                    Copy Family Code
                </button>
            </div>
            
            {/* Theme Settings */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Appearance
                </h2>
                
                <div className="space-y-2">
                    {['system', 'light', 'dark'].map(themeOption => (
                        <button
                            key={themeOption}
                            onClick={() => handleThemeChange(themeOption)}
                            className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between ${
                                theme === themeOption
                                    ? 'bg-indigo-50 dark:bg-indigo-900 border-2 border-indigo-600'
                                    : 'border-2 border-gray-200 dark:border-gray-600'
                            }`}
                        >
                            <span className="capitalize">{themeOption}</span>
                            {theme === themeOption && (
                                <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Data Management */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Data Management
                </h2>
                
                <div className="space-y-3">
                    <button
                        onClick={handleExportData}
                        className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white py-3 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Export Data
                    </button>
                    
                    <button
                        onClick={() => window.enhancedSyncManager.syncNow()}
                        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Sync Now
                    </button>
                </div>
            </div>
            
            {/* About */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    About
                </h2>
                
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p>Family Finance Hub v{APP_VERSION}</p>
                    <p>A secure, offline-first financial management app</p>
                    <p className="mt-4">Made with ❤️ for families</p>
                </div>
            </div>
        </div>
    );
}

// =====================================================
// NOTIFICATIONS COMPONENT
// =====================================================

function NotificationContainer() {
    const [notifications, setNotifications] = useState([]);
    
    useEffect(() => {
        if (window.notificationManager) {
            window.notificationManager.subscribe(setNotifications);
        }
    }, []);
    
    if (notifications.length === 0) return null;
    
    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map(notification => (
                <div
                    key={notification.id}
                    className={`notification-toast notification-${notification.type}`}
                >
                    <p>{notification.message}</p>
                </div>
            ))}
        </div>
    );
}

// =====================================================
// MAIN APP INITIALIZATION
// =====================================================

function App() {
    return (
        <AppProvider>
            <AppContent />
            <NotificationContainer />
        </AppProvider>
    );
}

function AppContent() {
    const context = useContext(AppContext);
    const { isLoggedIn, loading } = context;
    
    if (loading) {
        return (
            <div className="min-h-screen gradient-bg flex items-center justify-center">
                <div className="spinner"></div>
            </div>
        );
    }
    
    return isLoggedIn ? <MainApp /> : <LoginScreen />;
}

// Initialize notification manager
window.notificationManager = {
    notifications: [],
    observers: [],
    nextId: 1,
    
    add(message, type = 'info', duration = 5000) {
        const notification = {
            id: this.nextId++,
            message,
            type,
            timestamp: Date.now()
        };
        
        this.notifications.push(notification);
        this.notifyObservers();
        
        if (duration > 0) {
            setTimeout(() => this.remove(notification.id), duration);
        }
        
        return notification.id;
    },
    
    remove(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.notifyObservers();
    },
    
    subscribe(callback) {
        this.observers.push(callback);
    },
    
    notifyObservers() {
        this.observers.forEach(callback => callback([...this.notifications]));
    }
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);