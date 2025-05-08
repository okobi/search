describe('Search Flow with Openverse', () => {
    beforeEach(() => {
      cy.visit('/auth/signin');
      cy.get('button[data-provider="google"]').click(); // Mock or use test account
      cy.url().should('include', '/');
      cy.visit('/search');
    });
  
    it('should search Openverse, display results, and save history', () => {
      cy.intercept('GET', 'https://api.openverse.org/v1/images?q=nature*', {
        fixture: 'openverse-response.json',
      }).as('openverseRequest');
      cy.intercept('POST', '/api/search-history', { success: true }).as('saveSearch');
  
      cy.get('input[name="search"]').type('nature{enter}');
      cy.wait('@openverseRequest');
      cy.wait('@saveSearch');
  
      cy.get('.search-results').should('exist');
      cy.get('.result-item').should('have.length.greaterThan', 0);
    });
  });