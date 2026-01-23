// Web Worker for Mission Critical HR Payroll Calculations
// Offloads heavy computation from main thread to maintain 60fps UI


self.onmessage = function(event) {
    const { action, employees, month } = event.data;
    
    if (action === 'CALCULATE_PAYROLL') {
        const startTime = performance.now();
        const results = [];
        
        console.log(`[Payroll Worker] Starting calculations for ${employees.length} employees`);
        
        // Process each employee
        for (let i = 0; i < employees.length; i++) {
            const user = employees[i];
            
            // STRESS TEST - Simulate heavy computation
            // Block execution for 1-2ms per employee to prove worker isolation
            const blockStart = performance.now();
            while (performance.now() - blockStart < (1 + Math.random())); // 1-2ms block
            
            try {
                // Validate user data structure
                if (!user.financial) {
                    console.warn(`[Payroll Worker] User ${user.id} missing financial data, using defaults`);
                    // Set default financial data if missing
                    user.financial = {
                        baseSalary: 50000, // Default salary
                        taxBrackets: 'tier_1', // Default tax bracket
                        bankDetail: { bankName: 'N/A', accountNumber: 'N/A' }
                    };
                }
                
                // PAYROLL CALCULATIONS
                const grossPay = user.financial.baseSalary || 50000; // Default if missing
                
                // Determine tax rate based on tier
                let taxRate = 0.10; // Default 10% for tier_1
                const taxBracket = user.financial.taxBrackets || 'tier_1';
                if (taxBracket === 'tier_2') {
                    taxRate = 0.20; // 20% for tier_2
                }
                
                const taxDeduct = grossPay * taxRate;
                const netPay = grossPay - taxDeduct;
                
                // Create history object matching the required schema
                const payrollResult = {
                    userId: user.id,
                    
                    historyItem: {
                        id: self.crypto.randomUUID(),
                        month: month,
                        generatedAt: Date.now(),
                        calculations: {
                            grossPay: grossPay,
                            taxDeduct: taxDeduct,
                            netPay: netPay
                        }
                    },
                    
                    snapshot: {
                        baseSalary: grossPay,
                        currency: "USD",
                        taxBrackets: taxBracket,
                        bankDetails: user.financial.bankDetail || { bankName: 'N/A', accountNumber: 'N/A' }
                    }
                };
                
                results.push(payrollResult);
                
                // Progress reporting every 10 employees
                if ((i + 1) % 10 === 0 || i === employees.length - 1) {
                    console.log(`[Payroll Worker] Processed ${i + 1}/${employees.length} employees`);
                }
                
            } catch (error) {
                console.error(`[Payroll Worker] Error processing user ${user.id}:`, error);
                
                // Send error with more details
                self.postMessage({
                    type: 'ERROR',
                    message: `Error processing employee ${user.identity?.firstName || 'Unknown'}: ${error.message}`,
                    userId: user.id,
                    error: error.toString()
                });
                return;
            }
        }
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        
        console.log(`[Payroll Worker] Completed in ${processingTime.toFixed(2)}ms`);
        
        // Send results back to main thread
        self.postMessage({
            type: 'RESULT',
            data: results,
            metrics: {
                startTime: startTime,
                endTime: endTime,
                count: employees.length,
                processingTime: processingTime
            }
        });
        
    } else {
        // Handle unknown actions
        self.postMessage({
            type: 'ERROR',
            message: `Unknown action: ${action}`
        });
    }
};

// Handle worker errors
self.onerror = function(error) {
    console.error('[Payroll Worker] Error:', error);
    self.postMessage({
        type: 'ERROR',
        message: error.message || 'Unknown worker error'
    });
};

// Log worker initialization
console.log('[Payroll Worker] Initialized and ready for payroll calculations');