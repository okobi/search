describe('Auth Flow', () => {
    beforeEach(() => {
      cy.visit('/');
    });

    it('should sign in with credentials', () => {
      cy.intercept('POST', '/api/auth/**', { statusCode: 200, body: { error: null } }).as('signIn');
      cy.get('input[placeholder="Email"]').type('test@example.com');
      cy.get('input[placeholder="Password"]').type('password123');
      cy.get('button').contains('Sign In').click();
      cy.wait('@signIn');
      cy.url().should('include', '/home');
    });

    it('should toggle to sign-up and register', () => {
      cy.intercept('POST', '/api/auth/**', { statusCode: 200, body: { error: null } }).as('signUp');
      cy.get('button').contains('Sign Up').click();
      cy.get('input[placeholder="Name"]').type('Test User');
      cy.get('input[placeholder="Email"]').type('test@example.com');
      cy.get('input[placeholder="Password"]').type('password123');
      cy.get('button').contains('Sign Up').click();
      cy.wait('@signUp');
      cy.url().should('include', '/home');
    });

    it('should sign in with Google', () => {
      cy.intercept('GET', '/api/auth/**', { statusCode: 200, body: { error: null } }).as('googleSignIn');
      cy.get('button').contains('svg').first().click(); // Google button in sign-in form
      cy.wait('@googleSignIn');
      cy.url().should('include', '/home');
    });
  });