# TODO - Future Enhancements & Tasks

This document tracks potential improvements, features, and tasks for the VLX-ESTIMATOR application.

---

## 🔧 Features & Enhancements

### Pricing & Calculations
- [ ] **Profile Quantity Equations**: Implement equation support for profile quantities, similar to accessory equations. This would allow profiles to use formulas based on window dimensions (e.g., perimeter-based calculations for frame profiles).
- [ ] **Manual Exchange Rate Override**: Allow admin users to manually set/update a project's frozen exchange rate if needed (currently rate freezes automatically and cannot be changed).
- [ ] **Price History Tracking**: Track price changes over time for window items, allowing users to see price evolution.
- [ ] **Bulk Price Recalculation**: Admin tool to recalculate prices for existing window items when component costs change.

### User Management
- [ ] **Admin Markup Rebuild Tool**: Script or UI to rebuild prices for existing window items when a user's `adminMarkupPercent` is changed.
- [ ] **User Activity Dashboard**: Enhanced activity tracking and visualization for user actions.
- [ ] **User Permissions System**: More granular permissions beyond just admin/user roles (e.g., pricing tiers, feature access).

### Window Systems & Configuration
- [ ] **Window System Templates Library**: Pre-built window system templates for common configurations.
- [ ] **Window System Versioning**: Track changes to window systems over time, allow reverting to previous versions.
- [ ] **Bulk Window System Import**: Import multiple window systems from Excel/CSV.
- [ ] **Window System Duplication**: Quick duplicate/copy functionality for window systems.

### Projects & Quotes
- [ ] **Project Templates**: Save project configurations as templates for quick reuse.
- [ ] **Quote Comparison**: Compare multiple quotes side-by-side.
- [ ] **Quote Approval Workflow**: Multi-step approval process for quotes before sending to clients.
- [ ] **Email Quote**: Send quotes directly via email from the application.
- [ ] **Quote Expiration Reminders**: Automatic notifications when quotes are about to expire.

### UI/UX Improvements
- [ ] **Dark Mode**: Add dark mode theme option.
- [ ] **Responsive Design Enhancements**: Further optimize mobile experience.
- [ ] **Keyboard Shortcuts**: Add keyboard shortcuts for common actions.
- [ ] **Drag & Drop Reordering**: Allow drag-and-drop reordering of window items in project details.
- [ ] **Advanced Search/Filter**: Enhanced search and filtering capabilities across all list pages.

### Reporting & Analytics
- [ ] **Sales Reports**: Generate sales reports by user, project, date range, etc.
- [ ] **Component Usage Analytics**: Track which profiles, glasses, and hardware are used most frequently.
- [ ] **Profit Margin Analysis**: Calculate and display profit margins for projects and items.
- [ ] **Export to Multiple Formats**: Export quotes/projects to Excel, CSV, JSON in addition to PDF.

---

## 🐛 Bug Fixes & Technical Debt

### Code Quality
- [ ] **Remove Debug Logging**: Clean up extensive console.log statements added during debugging (especially in `configureWindow.ejs`).
- [ ] **Error Handling**: Improve error handling and user-friendly error messages throughout the application.
- [ ] **Input Validation**: Add more comprehensive client-side and server-side validation.
- [ ] **Code Refactoring**: Extract repeated logic into reusable functions/utilities.

### Performance
- [ ] **Database Indexing**: Review and optimize database indexes for better query performance.
- [ ] **Image Optimization**: Implement image compression/optimization for uploaded logos and accessory images.
- [ ] **Lazy Loading**: Implement lazy loading for large lists (projects, window items, etc.).
- [ ] **Caching**: Add caching layer for frequently accessed data (exchange rates, component lists, etc.).

### Security
- [ ] **Rate Limiting**: Implement rate limiting on API endpoints to prevent abuse.
- [ ] **Input Sanitization**: Review and enhance input sanitization for XSS prevention.
- [ ] **Session Security**: Review session configuration and security settings.
- [ ] **Password Policy**: Enforce stronger password requirements.

---

## 📚 Documentation

- [ ] **API Documentation**: Create comprehensive API documentation (Swagger/OpenAPI).
- [ ] **User Guide**: Create end-user documentation/help system.
- [ ] **Admin Guide**: Create detailed admin user guide.
- [ ] **Developer Setup Guide**: Enhance setup instructions for new developers.
- [ ] **Deployment Guide**: Document production deployment process.

---

## 🧪 Testing

- [ ] **Unit Tests**: Add unit tests for critical calculation functions.
- [ ] **Integration Tests**: Add integration tests for key workflows (create project, add window, generate quote).
- [ ] **E2E Tests**: Add end-to-end tests for critical user journeys.
- [ ] **Test Coverage**: Aim for minimum test coverage threshold.

---

## 🔄 Migration & Data Management

- [ ] **Data Migration Scripts**: Create scripts for migrating data between schema versions.
- [ ] **Backup & Restore**: Implement automated backup and restore functionality.
- [ ] **Data Export/Import**: Enhanced data export/import capabilities for all entities.
- [ ] **Archive Old Projects**: Feature to archive old projects to reduce database size.

---

## 🌐 Internationalization

- [ ] **Multi-language Support**: Add support for multiple languages (Spanish, English, etc.).
- [ ] **Localization**: Localize date formats, number formats, currency symbols based on user locale.
- [ ] **RTL Support**: Add right-to-left language support if needed.

---

## 📱 Mobile & Accessibility

- [ ] **Mobile App**: Consider native mobile app or PWA (Progressive Web App).
- [ ] **Accessibility Improvements**: Enhance accessibility (ARIA labels, keyboard navigation, screen reader support).
- [ ] **Touch Gestures**: Add touch gesture support for mobile devices.

---

## 🔌 Integrations

- [ ] **ERP Integration**: Integrate with ERP systems for order management.
- [ ] **Accounting Software**: Integration with accounting software (QuickBooks, etc.).
- [ ] **CRM Integration**: Connect with CRM systems for customer management.
- [ ] **Email Service**: Integrate with email service providers for automated emails.

---

## 💡 Ideas & Considerations

- [ ] **Real-time Collaboration**: Allow multiple users to work on the same project simultaneously.
- [ ] **Version Control for Projects**: Track changes to projects over time with ability to revert.
- [ ] **Custom Fields**: Allow users to add custom fields to projects/window items.
- [ ] **Workflow Automation**: Create automated workflows for common processes.
- [ ] **Notification System**: In-app notification system for important events.
- [ ] **Comments & Notes**: Add commenting/notes system for projects and items.
- [ ] **File Attachments**: Allow attaching files (images, documents) to projects/items.

---

## 📝 Notes

- Items are organized by category for easier navigation.
- Priority can be indicated by moving items to the top of their respective sections.
- When an item is completed, move it to a "Completed" section or remove it.
- Add new items as they are identified during development or user feedback.

---

*Last Updated: January 2026*
