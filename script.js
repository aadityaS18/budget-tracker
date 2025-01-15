// DOM Elements
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const incomeAmount = document.getElementById('income-amount');
const expenseAmount = document.getElementById('expense-amount');
const balanceAmount = document.getElementById('balance-amount');
const currencySelector = document.getElementById('currency');
const convertToSelector = document.getElementById('convert-to');
const convertButton = document.getElementById('convert-btn');
const expenseChartCanvas = document.getElementById('expense-chart').getContext('2d');
const trendChartCanvas = document.getElementById('trend-chart').getContext('2d');

// Variables
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let preferredCurrency = localStorage.getItem('preferredCurrency') || 'USD';

// Initialize Charts
let expenseChart;
let trendChart;

// API Key for ExchangeRate-API
const apiKey = "YOUR_API_KEY"; // Replace with your ExchangeRate-API key

// Helper Functions
function saveTransactions() {
  localStorage.setItem('transactions', JSON.stringify(transactions));
}

function calculateTotal(type) {
  return transactions
    .filter(t => t.type === type)
    .reduce((acc, t) => acc + t.amount, 0);
}

function calculateBalance() {
  const income = calculateTotal('income');
  const expenses = calculateTotal('expense');
  return income - expenses;
}

function getCurrencySymbol(currency) {
  const symbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
  return symbols[currency] || '$';
}

function updateSummary() {
  const currencySymbol = getCurrencySymbol(preferredCurrency);
  incomeAmount.textContent = `${currencySymbol}${calculateTotal('income').toFixed(2)}`;
  expenseAmount.textContent = `${currencySymbol}${calculateTotal('expense').toFixed(2)}`;
  balanceAmount.textContent = `${currencySymbol}${calculateBalance().toFixed(2)}`;
}

function renderTransactions() {
  transactionList.innerHTML = '';
  transactions.forEach((t, index) => {
    const li = document.createElement('li');
    li.className = t.type;
    li.textContent = `${t.description}: ${t.type === 'income' ? '+' : '-'}${getCurrencySymbol(preferredCurrency)}${t.amount.toFixed(2)}`;
    li.addEventListener('click', () => {
      transactions.splice(index, 1);
      saveTransactions();
      renderTransactions();
      updateSummary();
      updateCharts();
    });
    transactionList.appendChild(li);
  });
}

function showExpenseTips() {
  const categories = transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
  const highestCategory = Object.keys(categories).reduce((a, b) => categories[a] > categories[b] ? a : b, '');
  const tips = {
    food: 'Try cooking at home to save money!',
    transport: 'Consider carpooling or using public transport.',
    entertainment: 'Look for free or discounted events.',
    other: 'Review miscellaneous expenses to find savings opportunities.'
  };
  const tip = tips[highestCategory] || 'Keep tracking your expenses for better insights!';
  alert(`Tip: ${tip}`);
}

// Currency Conversion using ExchangeRate-API
async function convertCurrency(amount, fromCurrency, toCurrency) {
  // Validate the amount
  if (!amount || amount <= 0 || isNaN(amount)) {
    alert("No valid expenses to convert! Please add some expenses first.");
    return;
  }

  try {
    // Fetch conversion rate from ExchangeRate-API
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/pair/${fromCurrency}/${toCurrency}`);
    const data = await response.json();

    // Check if the API returned a valid result
    if (data && data.conversion_rate) {
      const conversionRate = data.conversion_rate;
      return (amount * conversionRate).toFixed(2);
    } else {
      alert("Failed to fetch conversion rates. Please check your API key or currency codes.");
      console.error(data);
      return 0;
    }
  } catch (error) {
    // Handle network or API errors
    alert("Error connecting to the currency conversion API. Please check your connection.");
    console.error(error);
    return 0;
  }
}

function updateCharts() {
  const expenseCategories = transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

  if (expenseChart) expenseChart.destroy();
  expenseChart = new Chart(expenseChartCanvas, {
    type: 'pie',
    data: {
      labels: Object.keys(expenseCategories),
      datasets: [{
        data: Object.values(expenseCategories),
        backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#ff9f40'],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
        },
      },
    },
  });

  const monthlyTrends = transactions.reduce((acc, t) => {
    const month = new Date(t.date).getMonth();
    acc[month] = (acc[month] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    return acc;
  }, []);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(trendChartCanvas, {
    type: 'line',
    data: {
      labels: Object.keys(monthlyTrends).map(m => `Month ${+m + 1}`),
      datasets: [{
        label: 'Cumulative Balance',
        data: Object.values(monthlyTrends),
        borderColor: '#36a2eb',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderWidth: 2,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

// Event Listeners
currencySelector.addEventListener('change', () => {
  preferredCurrency = currencySelector.value;
  localStorage.setItem('preferredCurrency', preferredCurrency);
  updateSummary();
});

transactionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const description = document.getElementById('description').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;

  // Push the transaction to the array
  transactions.push({
    description,
    amount,
    type: amount > 0 ? 'income' : 'expense',
    category,
    date: new Date(),
  });

  // Save transactions, update the UI, and reset the form
  saveTransactions();
  renderTransactions();
  updateSummary();
  updateCharts();
  showExpenseTips();
  transactionForm.reset();
});

convertButton.addEventListener('click', async () => {
  const targetCurrency = convertToSelector.value; // Get the target currency
  const totalExpenses = calculateTotal('expense'); // Get the total expenses

  // Convert the expenses and display the result
  const convertedAmount = await convertCurrency(totalExpenses, preferredCurrency, targetCurrency);
  if (convertedAmount > 0) {
    alert(`Total Expenses in ${targetCurrency}: ${getCurrencySymbol(targetCurrency)}${convertedAmount}`);
  }
});

// Initial Render
renderTransactions();
updateSummary();
updateCharts();
