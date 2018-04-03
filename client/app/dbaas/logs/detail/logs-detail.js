angular.module("managerApp").config($stateProvider => {
    $stateProvider
        .state("dbaas.logs.detail", {
            url: "/{serviceName:[a-zA-Z0-9]+-[a-zA-Z0-9\-]+}", // logs-12380-1231
            resolve: {
                serviceDetails: ($q, $state, $stateParams, LogsHomeService) => {
                    const serviceName = $stateParams.serviceName;
                    return LogsHomeService.getServiceDetails(serviceName);
                }
            },
            redirectTo: "dbaas.logs.detail.home",
            views: {
                logsHeader: {
                    templateUrl: "app/dbaas/logs/header/logs-dashboard-header.html",
                    controller: "LogsDashboardHeaderCtrl",
                    controllerAs: "ctrl"
                },
                logsContainer: {
                    templateUrl: "app/dbaas/logs/detail/logs-detail.html",
                    controller: "LogsDetailCtrl",
                    controllerAs: "ctrl"
                }
            },
            translations: ["common", "cloud", "dbaas/logs/detail"]
        });
});