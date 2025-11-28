// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('./middleware/authMiddleware');
const User = require('../models/User');
const Project = require('../models/Project');
const WindowItem = require('../models/WindowItem');
const ExcelJS = require('exceljs');

router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Fetch user - include companyLogo field (don't exclude it)
        const user = await User.findById(req.session.userId).lean();

        if (!user) {
            console.warn(`Dashboard access attempt with valid session but invalid userId: ${req.session.userId}`);
            req.session.destroy();
            return res.status(404).redirect('/auth/login');
        }

        // Fetch projects belonging to the logged-in user, sort by most recently updated
        const projects = await Project.find({ userId: req.session.userId })
                                        .sort({ updatedAt: -1 })
                                        .lean();

        // Get all window items for user's projects
        const projectIds = projects.map(p => p._id);
        const windowItems = await WindowItem.find({ projectId: { $in: projectIds } }).lean();

        // Calculate statistics
        const totalProjects = projects.length;
        const totalWindows = windowItems.length;
        const totalPortfolioValue = windowItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        const uniqueClients = new Set(projects.map(p => p.clientName).filter(name => name)).size;

        // Calculate window count and value per project
        const projectsWithStats = projects.map(project => {
            const projectWindows = windowItems.filter(item => 
                item.projectId.toString() === project._id.toString()
            );
            const projectWindowCount = projectWindows.length;
            const projectValue = projectWindows.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
            
            return {
                ...project,
                windowCount: projectWindowCount,
                projectValue: projectValue
            };
        });

        // Get the company logo from user's database record (NOT from file system)
        const companyLogo = user.companyLogo || null;

        // Pass data to the view
        res.render('dashboard', {
            user: {
                username: user.username,
                role: user.role
            },
            projects: projectsWithStats,
            companyLogo: companyLogo,
            stats: {
                totalProjects,
                totalWindows,
                totalPortfolioValue,
                uniqueClients
            }
        });

    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Export projects to Excel
router.get('/export-projects', isAuthenticated, async (req, res) => {
    try {
        // Fetch projects belonging to the logged-in user
        const projects = await Project.find({ userId: req.session.userId })
                                        .sort({ updatedAt: -1 })
                                        .lean();

        // Get all window items for user's projects
        const projectIds = projects.map(p => p._id);
        const windowItems = await WindowItem.find({ projectId: { $in: projectIds } }).lean();

        // Calculate window count and value per project
        const projectsWithStats = projects.map(project => {
            const projectWindows = windowItems.filter(item => 
                item.projectId.toString() === project._id.toString()
            );
            const projectWindowCount = projectWindows.length;
            const projectValue = projectWindows.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
            
            return {
                ...project,
                windowCount: projectWindowCount,
                projectValue: projectValue
            };
        });

        // Create a new Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Projects');

        // Add column headers
        worksheet.columns = [
            { header: 'Project Name', key: 'projectName', width: 30 },
            { header: 'Client Name', key: 'clientName', width: 25 },
            { header: 'Window Count', key: 'windowCount', width: 15 },
            { header: 'Project Value', key: 'projectValue', width: 20 },
            { header: 'Created Date', key: 'createdAt', width: 20 },
            { header: 'Last Updated', key: 'updatedAt', width: 20 }
        ];

        // Format the header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add project data to the worksheet
        projectsWithStats.forEach(project => {
            const createdDate = project.createdAt instanceof Date 
                ? project.createdAt 
                : new Date(project.createdAt);
            const updatedDate = (project.updatedAt || project.createdAt) instanceof Date
                ? (project.updatedAt || project.createdAt)
                : new Date(project.updatedAt || project.createdAt);

            worksheet.addRow({
                projectName: project.projectName || 'N/A',
                clientName: project.clientName || 'N/A',
                windowCount: project.windowCount || 0,
                projectValue: project.projectValue || 0,
                createdAt: createdDate.toLocaleDateString(),
                updatedAt: updatedDate.toLocaleDateString()
            });
        });

        // Format the value column
        worksheet.getColumn('projectValue').numFmt = '$#,##0.00';

        // Set content type and disposition
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=MyProjects.xlsx');

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting projects:', error);
        res.status(500).send('An error occurred while exporting projects');
    }
});

module.exports = router;